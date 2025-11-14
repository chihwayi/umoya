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
}

@Injectable()
export class TerminologyService {
  private readonly logger = new Logger(TerminologyService.name);
  private snomedApiClient: AxiosInstance;
  private snomedBaseUrl: string;
  private useLocalCache: boolean = true;

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
  ): Promise<SnomedSearchResult> {
    if (!term || term.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters');
    }

    try {
      // Check cache first if enabled
      if (this.useLocalCache) {
        const cached = await this.getCachedSearch(tenantDb, term, limit, offset);
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
        },
      });

      const concepts: SnomedConcept[] = (response.data.items || []).map((item: any) => ({
        conceptId: item.conceptId || item.id,
        term: item.fsn?.term || item.pt?.term || item.term || '',
        preferredTerm: item.pt?.term,
        fullySpecifiedName: item.fsn?.term,
        active: item.active !== false,
        moduleId: item.moduleId,
        definitionStatus: item.definitionStatus,
      }));

      const result: SnomedSearchResult = {
        concepts,
        total: response.data.total || concepts.length,
        limit,
        offset,
      };

      // Cache results if enabled
      if (this.useLocalCache) {
        await this.cacheSearch(tenantDb, term, result);
      }

      return result;
    } catch (error: any) {
      this.logger.error(`SNOMED CT search failed: ${error.message}`, error.stack);
      
      // Fallback to database cache if API fails
      if (this.useLocalCache) {
        const cached = await this.getCachedSearch(tenantDb, term, limit, offset);
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
  async mapConcept(
    tenantDb: DataSource,
    conceptId: string,
    targetSystem: 'ICD10' | 'ICD11' | 'LOINC' | 'CPT',
  ): Promise<SnomedMapping[]> {
    await this.validateConcept(tenantDb, conceptId);

    try {
      // Check database cache first
      const cachedMappings = await this.getCachedMappings(tenantDb, conceptId, targetSystem);
      if (cachedMappings.length > 0) {
        return cachedMappings;
      }

      // Query SNOMED CT mapping API or use reference set
      // Note: Actual implementation depends on available mapping resources
      const mappings: SnomedMapping[] = await this.querySnomedMappings(conceptId, targetSystem);

      // Cache mappings
      if (mappings.length > 0) {
        await this.cacheMappings(tenantDb, conceptId, mappings);
      }

      return mappings;
    } catch (error: any) {
      this.logger.error(`SNOMED CT mapping failed: ${error.message}`, error.stack);
      
      // Return cached mappings if available
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
    term: string,
    limit: number,
    offset: number,
  ): Promise<SnomedSearchResult | null> {
    try {
      const [result] = await tenantDb.query(
        `SELECT data FROM snomed_search_cache 
         WHERE search_term = $1 AND result_limit = $2 AND result_offset = $3 
         AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [term.toLowerCase(), limit, offset],
      );

      return result ? result.data : null;
    } catch (error) {
      this.logger.warn('Cache query failed, table may not exist yet');
      return null;
    }
  }

  private async cacheSearch(tenantDb: DataSource, term: string, result: SnomedSearchResult): Promise<void> {
    try {
      await tenantDb.query(
        `INSERT INTO snomed_search_cache (search_term, result_limit, result_offset, data, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (search_term, result_limit, result_offset) 
         DO UPDATE SET data = $4, created_at = NOW()`,
        [term.toLowerCase(), result.limit, result.offset, JSON.stringify(result)],
      );
    } catch (error) {
      this.logger.warn('Cache insert failed, table may not exist yet');
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
}

