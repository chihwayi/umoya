import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { env } from '@medicore/config';
import { TerminologyPostgresService } from './terminology-postgres.service';
import { getMasterDbConfig } from '../utils/runtime-env';

export interface RxNormConcept {
  rxcui: string;
  name: string;
  tty: string; // Term Type: IN (Ingredient), SCD (Semantic Clinical Drug), SBD (Semantic Branded Drug), etc.
  synonym?: string;
  language?: string;
}

export interface RxNormSearchResult {
  concepts: RxNormConcept[];
  total: number;
  limit: number;
  offset: number;
}

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
  private rxnormApiClient: AxiosInstance;
  private rxnormBaseUrl: string;
  
  // PostgreSQL-based SNOMED service (primary and only source)
  private postgresService: TerminologyPostgresService;
  private usePostgres: boolean = process.env.SNOMED_USE_POSTGRES !== 'false'; // Default to true
  private masterDb: DataSource | null = null;

  constructor() {
    // Initialize RxNorm API client (NLM RxNorm REST API)
    this.rxnormBaseUrl = String(process.env.RXNORM_BASE_URL || env.RXNORM_BASE_URL || '').trim();
    if (!this.rxnormBaseUrl) {
      throw new Error('RXNORM_BASE_URL is not configured.');
    }
    this.rxnormApiClient = axios.create({
      baseURL: this.rxnormBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize PostgreSQL service for SNOMED CT
    if (this.usePostgres) {
      this.postgresService = new TerminologyPostgresService();
      this.initializeMasterDb();
    } else {
      this.logger.warn('⚠️  PostgreSQL SNOMED CT search is disabled. Set SNOMED_USE_POSTGRES=true to enable.');
    }
  }

  /**
   * Initialize master database connection for SNOMED CT tables
   */
  private async initializeMasterDb() {
    try {
      const cfg = getMasterDbConfig(process.env.MASTER_POSTGRES_DB || process.env.POSTGRES_DB || 'medicore');
      this.masterDb = new DataSource({
        type: 'postgres',
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        password: cfg.password,
        database: cfg.database,
      });
      await this.masterDb.initialize();
      this.logger.log('✅ Master database connected for SNOMED CT PostgreSQL search');
    } catch (error: any) {
      this.logger.error(`❌ Failed to connect to master DB for PostgreSQL SNOMED search: ${error.message}`);
      this.logger.error('   SNOMED CT functionality will not be available. Please check database configuration.');
      this.usePostgres = false;
    }
  }

  /**
   * Get master database connection (for SNOMED CT tables)
   */
  private async getMasterDb(): Promise<DataSource> {
    if (!this.usePostgres) {
      throw new BadRequestException('PostgreSQL SNOMED CT search is not enabled. Set SNOMED_USE_POSTGRES=true.');
    }

    if (!this.masterDb || !this.masterDb.isInitialized) {
      await this.initializeMasterDb();
    }

    if (!this.masterDb || !this.masterDb.isInitialized) {
      throw new BadRequestException('Master database connection not available for SNOMED CT search.');
    }

    return this.masterDb;
  }

  // ========== SNOMED CT Methods (PostgreSQL Only) ==========

  /**
   * Search SNOMED CT concepts using PostgreSQL full-text search
   * @param tenantDb Tenant database connection (for caching, if needed)
   * @param term Search term
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @param activeOnly Only return active concepts
   * @param semanticTags Filter by semantic tags (optional)
   * @param ecl Expression Constraint Language query (optional, not used with PostgreSQL)
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

    if (!this.usePostgres || !this.postgresService) {
      throw new BadRequestException('PostgreSQL SNOMED CT search is not enabled. Set SNOMED_USE_POSTGRES=true.');
    }

    try {
      const masterDb = await this.getMasterDb();
      this.logger.debug(`Using PostgreSQL SNOMED search for: "${term}"`);
      return await this.postgresService.searchConcepts(masterDb, term, limit, offset, activeOnly);
    } catch (error: any) {
      this.logger.error(`PostgreSQL SNOMED search failed: ${error.message}`, error.stack);
      throw new BadRequestException(`SNOMED CT search failed: ${error.message}`);
    }
  }

  /**
   * Validate a SNOMED CT concept code
   * @param tenantDb Tenant database connection (for caching, if needed)
   * @param conceptId SNOMED CT concept ID
   */
  async validateConcept(tenantDb: DataSource, conceptId: string): Promise<SnomedConcept> {
    if (!conceptId || !/^\d+$/.test(conceptId)) {
      throw new BadRequestException('Invalid SNOMED CT concept ID format');
    }

    if (!this.usePostgres || !this.postgresService) {
      throw new BadRequestException('PostgreSQL SNOMED CT search is not enabled. Set SNOMED_USE_POSTGRES=true.');
    }

    try {
      const masterDb = await this.getMasterDb();
      return await this.postgresService.validateConcept(masterDb, conceptId);
    } catch (error: any) {
      this.logger.error(`PostgreSQL validateConcept failed: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`SNOMED CT concept ${conceptId} not found: ${error.message}`);
    }
  }

  /**
   * Get concept details including children and parents
   * @param tenantDb Tenant database connection (for caching, if needed)
   * @param conceptId SNOMED CT concept ID
   */
  async getConceptDetails(tenantDb: DataSource, conceptId: string): Promise<any> {
    if (!this.usePostgres || !this.postgresService) {
      throw new BadRequestException('PostgreSQL SNOMED CT search is not enabled. Set SNOMED_USE_POSTGRES=true.');
    }

    const concept = await this.validateConcept(tenantDb, conceptId);

    try {
      const masterDb = await this.getMasterDb();
      const [children, parents] = await Promise.all([
        this.postgresService.getChildren(masterDb, conceptId).catch(() => []),
        this.postgresService.getParents(masterDb, conceptId).catch(() => []),
      ]);

      return {
        concept,
        children: children.map((c: any) => ({
          conceptId: c.conceptId,
          term: c.term,
        })),
        parents: parents.map((c: any) => ({
          conceptId: c.conceptId,
          term: c.term,
        })),
      };
    } catch (error: any) {
      this.logger.warn(`Failed to fetch concept details: ${error.message}`);
      return { concept, children: [], parents: [] };
    }
  }

  /**
   * Get ancestor concepts for a SNOMED CT concept
   * @param tenantDb Tenant database connection (for caching, if needed)
   * @param conceptId SNOMED CT concept ID
   */
  async getAncestors(tenantDb: DataSource, conceptId: string): Promise<SnomedConcept[]> {
    if (!this.usePostgres || !this.postgresService) {
      throw new BadRequestException('PostgreSQL SNOMED CT search is not enabled. Set SNOMED_USE_POSTGRES=true.');
    }

    try {
      const masterDb = await this.getMasterDb();
      return await this.postgresService.getAncestors(masterDb, conceptId);
    } catch (error: any) {
      this.logger.error(`Failed to fetch ancestors: ${error.message}`, error.stack);
      return [];
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

    // Use master database for ICD-10 mappings (shared across all tenants)
    const masterDb = await this.getMasterDb();
    const dbToUse = masterDb;

    const includeInactive = options?.includeInactive ?? false;
    const limit = options?.limit ?? 50;
    const params: any[] = [conceptId];
    let query = `
      SELECT m.snomed_code as concept_id,
             m.icd10_code as target_code,
             i.description as target_display,
             1 as map_group,
             m.map_priority,
             m.map_rule,
             NULL as map_advice,
             NULL as map_status,
             m.map_category as map_category_id,
             NULL as module_id,
             NULL as effective_time,
             m.active,
             NULL as map_source
        FROM snomed_to_icd10_map m
        LEFT JOIN icd10_codes i ON m.icd10_code = i.code
       WHERE m.snomed_code = $1
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
      const rows = await dbToUse.query(query, params);
      const results = rows.map((row: any) => this.mapIcd10Row(row));
      if (options?.primaryOnly) {
        return this.collapseToPrimary(results);
      }
      return results;
    } catch (error: any) {
      if (error?.code === '42P01') {
        this.logger.error(`ICD-10 table missing: ${error.message}`);
        throw new NotFoundException(
          'ICD-10 mapping tables are not provisioned. Please run the ICD-10 mapping import script.',
        );
      }
      this.logger.error(`Failed to fetch ICD-10 mappings: ${error.message}`, error.stack);
      throw new BadRequestException('Unable to fetch ICD-10 mappings at this time');
    }
  }

  async getIcd10MappingMetadata(tenantDb: DataSource) {
    // Use master database for ICD-10 mapping metadata (shared across all tenants)
    const masterDb = await this.getMasterDb();
    const dbToUse = masterDb;

    try {
      const [row] = await dbToUse.query(`
        SELECT file_name as release_label,
               end_time as effective_time,
               file_name as source_zip,
               total_rows,
               start_time as import_started_at,
               end_time as import_completed_at
          FROM terminology_import_jobs
         WHERE type = 'snomed' AND status = 'completed'
         ORDER BY end_time DESC
         LIMIT 1
      `);
      return row || null;
    } catch (error: any) {
      if (error?.code === '42P01') {
        this.logger.warn('Terminology import jobs table missing; import may not have been run yet.');
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

    // Other mapping systems not yet implemented
    throw new BadRequestException(`Mapping to ${targetSystem} is not yet implemented`);
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

  // ========== RxNorm Methods ==========

  /**
   * Search RxNorm concepts by drug name
   * @param term Search term (drug name, brand name, or ingredient)
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   */
  async searchRxNorm(
    term: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<RxNormSearchResult> {
    if (!term || term.trim().length === 0) {
      throw new BadRequestException('Search term is required');
    }

    try {
      // Use RxNorm approximate match API
      const response = await this.rxnormApiClient.get('/drugs.json', {
        params: {
          name: term.trim(),
        },
      });

      const drugGroup = response.data?.drugGroup;
      if (!drugGroup || !drugGroup.conceptGroup) {
        return {
          concepts: [],
          total: 0,
          limit,
          offset,
        };
      }

      const concepts: RxNormConcept[] = [];
      
      // Process concept groups (different TTYs)
      for (const group of drugGroup.conceptGroup) {
        if (group.conceptProperties) {
          for (const concept of Array.isArray(group.conceptProperties) 
            ? group.conceptProperties 
            : [group.conceptProperties]) {
            concepts.push({
              rxcui: concept.rxcui,
              name: concept.name,
              tty: concept.tty || 'UNKNOWN',
              synonym: concept.synonym,
              language: concept.language || 'ENG',
            });
          }
        }
      }

      // Apply pagination
      const total = concepts.length;
      const paginatedConcepts = concepts.slice(offset, offset + limit);

      this.logger.log(`RxNorm search for "${term}": ${total} results, returning ${paginatedConcepts.length}`);

      return {
        concepts: paginatedConcepts,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      this.logger.error(`RxNorm search failed: ${error.message}`, error.stack);
      throw new BadRequestException(`RxNorm search failed: ${error.message}`);
    }
  }

  /**
   * Get RxNorm concept details by RXCUI
   * @param rxcui RxNorm concept unique identifier
   */
  async getRxNormConcept(rxcui: string): Promise<RxNormConcept | null> {
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      throw new BadRequestException('Invalid RXCUI format. Must be numeric.');
    }

    try {
      // Get all properties for the concept
      const [propertiesResponse, allPropertiesResponse] = await Promise.all([
        this.rxnormApiClient.get(`/rxcui/${rxcui}/properties.json`),
        this.rxnormApiClient.get(`/rxcui/${rxcui}/allproperties.json`),
      ]);

      const properties = propertiesResponse.data?.properties;
      const allProperties = allPropertiesResponse.data?.properties;

      if (!properties && !allProperties) {
        return null;
      }

      const props = properties || allProperties?.[0] || {};

      return {
        rxcui: props.rxcui || rxcui,
        name: props.name || props.synonym || 'Unknown',
        tty: props.tty || 'UNKNOWN',
        synonym: props.synonym,
        language: props.language || 'ENG',
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`RxNorm concept lookup failed: ${error.message}`, error.stack);
      throw new NotFoundException(`RxNorm concept ${rxcui} not found`);
    }
  }

  /**
   * Validate RxNorm RXCUI
   * @param rxcui RxNorm concept unique identifier
   */
  async validateRxNorm(rxcui: string): Promise<{ valid: boolean; concept?: RxNormConcept }> {
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      return { valid: false };
    }

    try {
      const concept = await this.getRxNormConcept(rxcui);
      return {
        valid: concept !== null,
        concept: concept || undefined,
      };
    } catch (error: any) {
      return { valid: false };
    }
  }

  /**
   * Get related RxNorm concepts (ingredients, brand names, etc.)
   * @param rxcui RxNorm concept unique identifier
   * @param rela Relationship type (e.g., 'IN', 'SCD', 'SBD')
   */
  async getRxNormRelated(
    rxcui: string,
    rela?: string,
  ): Promise<RxNormConcept[]> {
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      throw new BadRequestException('Invalid RXCUI format. Must be numeric.');
    }

    try {
      const endpoint = rela 
        ? `/rxcui/${rxcui}/related.json?tty=${rela}`
        : `/rxcui/${rxcui}/related.json`;

      const response = await this.rxnormApiClient.get(endpoint);
      const relatedGroup = response.data?.relatedGroup;

      if (!relatedGroup || !relatedGroup.conceptGroup) {
        return [];
      }

      const concepts: RxNormConcept[] = [];

      for (const group of relatedGroup.conceptGroup) {
        if (group.conceptProperties) {
          for (const concept of Array.isArray(group.conceptProperties)
            ? group.conceptProperties
            : [group.conceptProperties]) {
            concepts.push({
              rxcui: concept.rxcui,
              name: concept.name,
              tty: concept.tty || 'UNKNOWN',
              synonym: concept.synonym,
              language: concept.language || 'ENG',
            });
          }
        }
      }

      return concepts;
    } catch (error: any) {
      this.logger.error(`RxNorm related concepts lookup failed: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get RxNorm concept by name (exact match preferred)
   * @param name Drug name
   */
  async findRxNormByName(name: string): Promise<RxNormConcept | null> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Drug name is required');
    }

    try {
      // First try exact match
      const response = await this.rxnormApiClient.get('/drugs.json', {
        params: {
          name: name.trim(),
        },
      });

      const drugGroup = response.data?.drugGroup;
      if (!drugGroup || !drugGroup.conceptGroup) {
        return null;
      }

      // Prefer SCD (Semantic Clinical Drug) or SBD (Semantic Branded Drug)
      const preferredTTYs = ['SCD', 'SBD', 'SCDC', 'SBDC', 'GPCK', 'BPCK'];
      
      for (const tty of preferredTTYs) {
        const group = drugGroup.conceptGroup.find((g: any) => g.tty === tty);
        if (group?.conceptProperties) {
          const concept = Array.isArray(group.conceptProperties)
            ? group.conceptProperties[0]
            : group.conceptProperties;
          if (concept) {
            return {
              rxcui: concept.rxcui,
              name: concept.name,
              tty: concept.tty || tty,
              synonym: concept.synonym,
              language: concept.language || 'ENG',
            };
          }
        }
      }

      // Fallback to first available concept
      for (const group of drugGroup.conceptGroup) {
        if (group.conceptProperties) {
          const concept = Array.isArray(group.conceptProperties)
            ? group.conceptProperties[0]
            : group.conceptProperties;
          if (concept) {
            return {
              rxcui: concept.rxcui,
              name: concept.name,
              tty: concept.tty || 'UNKNOWN',
              synonym: concept.synonym,
              language: concept.language || 'ENG',
            };
          }
        }
      }

      return null;
    } catch (error: any) {
      this.logger.error(`RxNorm find by name failed: ${error.message}`, error.stack);
      return null;
    }
  }
}
