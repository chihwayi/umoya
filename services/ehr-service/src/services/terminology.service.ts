import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';

export interface SnomedConcept {
  conceptId: string;
  term: string;
  preferredTerm?: string;
  fullySpecifiedName?: string;
  active: boolean;
  moduleId?: string;
  definitionStatus?: string;
  semanticTag?: string;
}

export interface SnomedSearchResult {
  concepts: SnomedConcept[];
  total: number;
  limit: number;
  offset: number;
}

export interface SnomedMapping {
  sourceCode: string;
  targetCode: string;
  targetSystem: 'ICD10' | 'ICD11' | 'LOINC' | 'CPT';
  mapCategory: string;
  active: boolean;
  mapGroup?: number;
  mapPriority?: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  mapSource?: string;
  effectiveTime?: string;
}

export interface Icd10MappingRecord {
  conceptId: string;
  targetCode: string;
  targetDisplay?: string;
  mapGroup: number;
  mapPriority: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  mapCategoryId?: string;
  moduleId?: string;
  effectiveTime?: string;
  active: boolean;
  mapSource?: string;
}

@Injectable()
export class TerminologyService {
  private readonly logger = new Logger(TerminologyService.name);
  private snomedApiClient: AxiosInstance;
  private snomedBaseUrl: string;
  private useLocalCache: boolean = true;
  private strictEclFiltering: boolean = process.env.SNOMED_STRICT_ECL === 'true';
  private ancestorCache = new Map<string, { ids: string[]; fetchedAt: number }>();
  private ancestorCacheTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 days

  constructor() {
    // Initialize SNOMED CT API client
    // Supports both Snowstorm (local) and SNOMED CT API (cloud)
    // For development without Snowstorm, set SNOMED_BASE_URL to a mock/test endpoint
    this.snomedBaseUrl = process.env.SNOMED_BASE_URL || 'http://localhost:8080';
    this.useLocalCache = process.env.SNOMED_USE_CACHE !== 'false'; // Default to true

    this.snomedApiClient = axios.create({
      baseURL: this.snomedBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
      },
    });
  }

  /**
   * Search SNOMED CT concepts by term
   * @param tenantDb Tenant database connection
   * @param term Search term
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @param activeOnly Only return active concepts
   */
  async searchConcepts(
    tenantDb: DataSource,
    term: string,
    limit: number = 50,
    offset: number = 0,
    activeOnly: boolean = true,
    semanticTags?: string[],
    ecl?: string,
  ): Promise<SnomedSearchResult> {
    if (!term || term.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters');
    }

    const normalizedTags =
      semanticTags
        ?.map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0) || undefined;
    const normalizedEcl = ecl?.trim() || undefined;
    const cacheKey = this.buildSearchCacheKey(term, activeOnly, normalizedTags, normalizedEcl);

    try {
      // Check cache first if enabled
      if (this.useLocalCache) {
        const cached = await this.getCachedSearch(tenantDb, cacheKey, limit, offset);
        if (cached) {
          this.logger.debug(`Returning cached search results for: ${term}`);
          return cached;
        }
      }

      // Search SNOMED CT via API
      const response = await this.snomedApiClient.get('/browser/MAIN/concepts', {
        params: {
          term: term.trim(),
          limit: Math.min(limit, 100), // Cap at 100
          offset,
          activeFilter: activeOnly,
          groupByConcept: true,
          semanticTags: normalizedTags?.join(',') || undefined,
          ecl: normalizedEcl,
        },
      });

      const concepts: SnomedConcept[] = (response.data.items || []).map((item: any) => ({
        conceptId: item.conceptId || item.id,
        term: item.pt?.term || item.fsn?.term || item.term || '',
        preferredTerm: item.pt?.term,
        fullySpecifiedName: item.fsn?.term,
        active: item.active !== false,
        moduleId: item.moduleId,
        definitionStatus: item.definitionStatus,
        semanticTag: this.extractSemanticTag(item.fsn?.term),
      }));

      let filteredConcepts = concepts;
      if (activeOnly) {
        filteredConcepts = filteredConcepts.filter((concept) => concept.active);
      }

      if (normalizedTags?.length) {
        filteredConcepts = filteredConcepts.filter((concept) =>
          concept.semanticTag ? normalizedTags.includes(concept.semanticTag) : false,
        );
      }

      if (this.strictEclFiltering && normalizedEcl) {
        const eclRoots = this.extractEclRoots(normalizedEcl);
        if (eclRoots.length > 0) {
          const conceptChecks = await Promise.all(
            filteredConcepts.map(async (concept) => {
              if (eclRoots.includes(concept.conceptId)) {
                return true;
              }
              const ancestors = await this.getAncestorIds(concept.conceptId);
              return ancestors.some((ancestorId) => eclRoots.includes(ancestorId));
            }),
          );
          const hasAnyMatch = conceptChecks.some(Boolean);
          if (hasAnyMatch) {
            filteredConcepts = filteredConcepts.filter((_, idx) => conceptChecks[idx]);
          } else {
            this.logger.warn(
              `ECL filter "${normalizedEcl}" returned no matches for term "${term}". Falling back to semantic filtering only.`,
            );
          }
        }
      }

      const pagedConcepts = filteredConcepts.slice(offset, offset + limit);

      const result: SnomedSearchResult = {
        concepts: pagedConcepts,
        total: filteredConcepts.length,
        limit,
        offset,
      };

      // Cache results if enabled
      if (this.useLocalCache) {
        await this.cacheSearch(tenantDb, cacheKey, result);
      }

      return result;
    } catch (error: any) {
      this.logger.error(`SNOMED CT search failed: ${error.message}`, error.stack);
      
      // Fallback to database cache if API fails
      if (this.useLocalCache) {
        const cached = await this.getCachedSearch(tenantDb, cacheKey, limit, offset);
        if (cached) {
          this.logger.warn('Using cached results due to API failure');
          return cached;
        }
      }

      throw new BadRequestException(
        `SNOMED CT search failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Validate a SNOMED CT concept code
   * @param tenantDb Tenant database connection
   * @param conceptId SNOMED CT concept ID
   */
  async validateConcept(tenantDb: DataSource, conceptId: string): Promise<SnomedConcept> {
    if (!conceptId || !/^\d+$/.test(conceptId)) {
      throw new BadRequestException('Invalid SNOMED CT concept ID format');
    }

    try {
      // Check cache first
      if (this.useLocalCache) {
        const cached = await this.getCachedConcept(tenantDb, conceptId);
        if (cached) {
          return cached;
        }
      }

      // Fetch from SNOMED CT API
      const response = await this.snomedApiClient.get(`/browser/MAIN/concepts/${conceptId}`);

      const concept: SnomedConcept = {
        conceptId: response.data.conceptId || conceptId,
        term: response.data.fsn?.term || response.data.pt?.term || '',
        preferredTerm: response.data.pt?.term,
        fullySpecifiedName: response.data.fsn?.term,
        active: response.data.active !== false,
        moduleId: response.data.moduleId,
        definitionStatus: response.data.definitionStatus,
      };

      // Cache if enabled
      if (this.useLocalCache) {
        await this.cacheConcept(tenantDb, concept);
      }

      if (!concept.active) {
        throw new NotFoundException(`SNOMED CT concept ${conceptId} is not active`);
      }

      return concept;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`SNOMED CT validation failed: ${error.message}`, error.stack);

      // Fallback to cache
      if (this.useLocalCache) {
        const cached = await this.getCachedConcept(tenantDb, conceptId);
        if (cached) {
          return cached;
        }
      }

      throw new NotFoundException(
        `SNOMED CT concept ${conceptId} not found: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get concept details including children and parents
   * @param tenantDb Tenant database connection
   * @param conceptId SNOMED CT concept ID
   */
  async getConceptDetails(tenantDb: DataSource, conceptId: string): Promise<any> {
    const concept = await this.validateConcept(tenantDb, conceptId);

    try {
      const [childrenResponse, parentsResponse] = await Promise.all([
        this.snomedApiClient.get(`/browser/MAIN/concepts/${conceptId}/children`).catch(() => ({ data: { items: [] } })),
        this.snomedApiClient.get(`/browser/MAIN/concepts/${conceptId}/parents`).catch(() => ({ data: { items: [] } })),
      ]);

      return {
        concept,
        children: (childrenResponse.data.items || []).map((item: any) => ({
          conceptId: item.conceptId,
          term: item.fsn?.term || item.pt?.term,
        })),
        parents: (parentsResponse.data.items || []).map((item: any) => ({
          conceptId: item.conceptId,
          term: item.fsn?.term || item.pt?.term,
        })),
      };
    } catch (error: any) {
      this.logger.warn(`Failed to fetch concept details: ${error.message}`);
      return { concept, children: [], parents: [] };
    }
  }

  /**
   * Map SNOMED CT code to another terminology system
   * @param tenantDb Tenant database connection
   * @param conceptId SNOMED CT concept ID
   * @param targetSystem Target terminology system (ICD10, ICD11, LOINC, CPT)
   */
  async getIcd10Mappings(
    tenantDb: DataSource,
    conceptId: string,
    options?: { primaryOnly?: boolean; includeInactive?: boolean; limit?: number },
  ): Promise<Icd10MappingRecord[]> {
    if (!conceptId || !/^\d+$/.test(conceptId)) {
      throw new BadRequestException('Invalid SNOMED CT concept ID format');
    }

    const includeInactive = options?.includeInactive ?? false;
    const limit = options?.limit ?? 50;
    const params: any[] = [conceptId];
    let query = `
      SELECT concept_id,
             target_code,
             target_display,
             map_group,
             map_priority,
             map_rule,
             map_advice,
             map_status,
             map_category_id,
             module_id,
             effective_time,
             active,
             map_source
        FROM snomed_icd10_mappings
       WHERE concept_id = $1
    `;

    if (!includeInactive) {
      query += ' AND active = true';
    }

    query += ' ORDER BY map_group ASC, map_priority ASC';

    if (limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    try {
      const rows = await tenantDb.query(query, params);
      const results = rows.map((row: any) => this.mapIcd10Row(row));
      if (options?.primaryOnly) {
        return this.collapseToPrimary(results);
      }
      return results;
    } catch (error: any) {
      if (error?.code === '42P01') {
        throw new NotFoundException(
          'ICD-10 mapping tables are not provisioned for this tenant. Apply the icd10_mapping bundle first.',
        );
      }
      this.logger.error(`Failed to fetch ICD-10 mappings: ${error.message}`, error.stack);
      throw new BadRequestException('Unable to fetch ICD-10 mappings at this time');
    }
  }

  async getIcd10MappingMetadata(tenantDb: DataSource) {
    try {
      const [row] = await tenantDb.query(`
        SELECT release_label,
               effective_time,
               source_zip,
               total_rows,
               import_started_at,
               import_completed_at
          FROM icd10_mapping_metadata
         ORDER BY import_completed_at DESC NULLS LAST, import_started_at DESC
         LIMIT 1
      `);
      return row || null;
    } catch (error: any) {
      if (error?.code === '42P01') {
        this.logger.warn('ICD-10 mapping metadata table missing; bundle likely not applied yet.');
        return null;
      }
      this.logger.warn(`Failed to fetch ICD-10 mapping metadata: ${error.message}`);
      return null;
    }
  }

  async mapConcept(
    tenantDb: DataSource,
    conceptId: string,
    targetSystem: 'ICD10' | 'ICD11' | 'LOINC' | 'CPT',
  ): Promise<SnomedMapping[]> {
    await this.validateConcept(tenantDb, conceptId);

    if (targetSystem === 'ICD10') {
      const mappings = await this.getIcd10Mappings(tenantDb, conceptId, {
        includeInactive: false,
        primaryOnly: false,
      });
      if (!mappings.length) {
        throw new NotFoundException(`No ICD-10 mappings found for SNOMED concept ${conceptId}`);
      }
      return mappings.map((row) => ({
        sourceCode: conceptId,
        targetCode: row.targetCode,
        targetSystem: 'ICD10',
        mapCategory: row.mapCategoryId || row.mapStatus || 'UNSPECIFIED',
        active: row.active,
        mapGroup: row.mapGroup,
        mapPriority: row.mapPriority,
        mapRule: row.mapRule,
        mapAdvice: row.mapAdvice,
        mapStatus: row.mapStatus,
        mapSource: row.mapSource,
        effectiveTime: row.effectiveTime,
      }));
    }

    try {
      const cachedMappings = await this.getCachedMappings(tenantDb, conceptId, targetSystem);
      if (cachedMappings.length > 0) {
        return cachedMappings;
      }

      const mappings: SnomedMapping[] = await this.querySnomedMappings(conceptId, targetSystem);

      if (mappings.length > 0) {
        await this.cacheMappings(tenantDb, conceptId, mappings);
      }

      return mappings;
    } catch (error: any) {
      this.logger.error(`SNOMED CT mapping failed: ${error.message}`, error.stack);

      const cachedMappings = await this.getCachedMappings(tenantDb, conceptId, targetSystem);
      if (cachedMappings.length > 0) {
        return cachedMappings;
      }

      throw new NotFoundException(
        `No mappings found for SNOMED CT concept ${conceptId} to ${targetSystem}`,
      );
    }
  }

  /**
   * Query SNOMED CT mappings (placeholder - implement based on available mapping resources)
   */
  private async querySnomedMappings(
    conceptId: string,
    targetSystem: string,
  ): Promise<SnomedMapping[]> {
    // This is a placeholder - actual implementation would query SNOMED CT mapping reference sets
    // or use external mapping services
    this.logger.warn(`Mapping query not fully implemented for ${targetSystem}`);
    return [];
  }

  // Cache management methods

  private async getCachedSearch(
    tenantDb: DataSource,
    cacheKey: string,
    limit: number,
    offset: number,
  ): Promise<SnomedSearchResult | null> {
    try {
      const [result] = await tenantDb.query(
        `SELECT data FROM snomed_search_cache 
         WHERE search_term = $1 AND result_limit = $2 AND result_offset = $3 
         AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [cacheKey, limit, offset],
      );

      return result ? result.data : null;
    } catch (error) {
      this.logger.warn('Cache query failed, table may not exist yet');
      return null;
    }
  }

  private async cacheSearch(tenantDb: DataSource, cacheKey: string, result: SnomedSearchResult): Promise<void> {
    try {
      await tenantDb.query(
        `INSERT INTO snomed_search_cache (search_term, result_limit, result_offset, data, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (search_term, result_limit, result_offset) 
         DO UPDATE SET data = $4, created_at = NOW()`,
        [cacheKey, result.limit, result.offset, JSON.stringify(result)],
      );
    } catch (error) {
      this.logger.warn('Cache insert failed, table may not exist yet');
    }
  }

  private buildSearchCacheKey(
    term: string,
    activeOnly: boolean,
    semanticTags?: string[],
    ecl?: string,
  ): string {
    const normalizedTerm = term.trim().toLowerCase();
    const tagKey = semanticTags && semanticTags.length > 0 ? semanticTags.sort().join('|') : 'all';
    const eclKey = ecl ? ecl.trim().toLowerCase() : 'none';
    const activeKey = activeOnly ? 'active' : 'all';
    return `${normalizedTerm}::${activeKey}::${tagKey}::${eclKey}`;
  }

  private extractSemanticTag(fsn?: string): string | undefined {
    if (!fsn) {
      return undefined;
    }
    const match = fsn.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim().toLowerCase() : undefined;
  }

  private extractEclRoots(ecl: string): string[] {
    if (!ecl) {
      return [];
    }
    const matches = ecl.match(/\d{3,}/g);
    return matches ? Array.from(new Set(matches)) : [];
  }

  private async getAncestorIds(conceptId: string): Promise<string[]> {
    const cached = this.ancestorCache.get(conceptId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.ancestorCacheTtlMs) {
      return cached.ids;
    }

    try {
      const response = await this.snomedApiClient.get(`/browser/MAIN/concepts/${conceptId}/ancestors`, {
        params: { form: 'inferred' },
      });
      const ids: string[] = (response.data.items || []).map((item: any) => item.conceptId);
      this.ancestorCache.set(conceptId, { ids, fetchedAt: now });
      return ids;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch ancestors for concept ${conceptId}: ${error.message}`);
      return [];
    }
  }

  private async getCachedConcept(tenantDb: DataSource, conceptId: string): Promise<SnomedConcept | null> {
    try {
      const [result] = await tenantDb.query(
        `SELECT concept_data FROM snomed_concept_cache 
         WHERE concept_id = $1 AND created_at > NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [conceptId],
      );

      return result ? result.concept_data : null;
    } catch (error) {
      return null;
    }
  }

  private async cacheConcept(tenantDb: DataSource, concept: SnomedConcept): Promise<void> {
    try {
      await tenantDb.query(
        `INSERT INTO snomed_concept_cache (concept_id, concept_data, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (concept_id) 
         DO UPDATE SET concept_data = $2, created_at = NOW()`,
        [concept.conceptId, JSON.stringify(concept)],
      );
    } catch (error) {
      // Ignore cache errors
    }
  }

  private async getCachedMappings(
    tenantDb: DataSource,
    conceptId: string,
    targetSystem: string,
  ): Promise<SnomedMapping[]> {
    try {
      const results = await tenantDb.query(
        `SELECT mapping_data FROM snomed_mapping_cache 
         WHERE source_code = $1 AND target_system = $2 AND active = true
         ORDER BY created_at DESC`,
        [conceptId, targetSystem],
      );

      return results.map((r: any) => r.mapping_data);
    } catch (error) {
      return [];
    }
  }

  private async cacheMappings(tenantDb: DataSource, conceptId: string, mappings: SnomedMapping[]): Promise<void> {
    try {
      for (const mapping of mappings) {
        await tenantDb.query(
          `INSERT INTO snomed_mapping_cache 
           (source_code, target_code, target_system, map_category, active, mapping_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (source_code, target_code, target_system) 
           DO UPDATE SET mapping_data = $6, active = $5, created_at = NOW()`,
          [
            conceptId,
            mapping.targetCode,
            mapping.targetSystem,
            mapping.mapCategory,
            mapping.active,
            JSON.stringify(mapping),
          ],
        );
      }
    } catch (error) {
      // Ignore cache errors
    }
  }

  private mapIcd10Row(row: any): Icd10MappingRecord {
    return {
      conceptId: row.concept_id,
      targetCode: row.target_code,
      targetDisplay: row.target_display ?? undefined,
      mapGroup: Number(row.map_group) || 1,
      mapPriority: Number(row.map_priority) || 1,
      mapRule: row.map_rule ?? undefined,
      mapAdvice: row.map_advice ?? undefined,
      mapStatus: row.map_status ?? undefined,
      mapCategoryId: row.map_category_id ?? undefined,
      moduleId: row.module_id ?? undefined,
      effectiveTime: row.effective_time ?? undefined,
      active: row.active ?? false,
      mapSource: row.map_source ?? undefined,
    };
  }

  private collapseToPrimary(rows: Icd10MappingRecord[]): Icd10MappingRecord[] {
    const byGroup = new Map<number, Icd10MappingRecord>();
    for (const row of rows) {
      if (!byGroup.has(row.mapGroup)) {
        byGroup.set(row.mapGroup, row);
      }
    }
    return Array.from(byGroup.values()).sort((a, b) => a.mapGroup - b.mapGroup);
  }
}

