import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ICD10Code {
  code: string;
  description: string;
  category: string;
  category_description: string;
  billable: boolean;
  rank?: number;
}

export interface ICD10CodeDetails extends ICD10Code {
  includes: string[];
  excludes: string[];
  notes: string;
  valid_for_coding: boolean;
}

export interface SnomedToIcd10Mapping {
  snomed_code: string;
  snomed_term: string;
  icd10_code: string;
  icd10_description: string;
  map_category: string;
  correlation: string;
  map_priority: number;
}

@Injectable()
export class Icd10Service {
  private logger = new Logger(Icd10Service.name);
  private masterDb: DataSource;

  /**
   * Initialize master database connection for ICD-10 tables
   */
  private async initializeMasterDb() {
    try {
      this.masterDb = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'medicore',
        password: process.env.DB_PASSWORD || 'medicore_password',
        database: process.env.POSTGRES_DB || 'medicore_master',
      });
      await this.masterDb.initialize();
      this.logger.log('✅ Master database connected for ICD-10 search');
    } catch (error: any) {
      this.logger.error(`❌ Failed to connect to master DB for ICD-10 search: ${error.message}`);
      throw new BadRequestException('Master database connection not available for ICD-10 search.');
    }
  }

  /**
   * Get master database connection
   */
  private async getMasterDb(): Promise<DataSource> {
    if (!this.masterDb || !this.masterDb.isInitialized) {
      await this.initializeMasterDb();
    }
    return this.masterDb;
  }

  /**
   * Search ICD-10 codes using full-text search
   */
  async searchIcd10Codes(
    term: string,
    limit: number = 20,
    offset: number = 0,
    billableOnly: boolean | null = null,
    tenantDb: DataSource,
  ): Promise<ICD10Code[]> {
    if (!term || term.trim().length < 2) {
      return [];
    }

    const masterDb = await this.getMasterDb();
    const query = `
      SELECT * FROM search_icd10_codes($1, $2, $3, $4)
    `;

    const results = await masterDb.query(query, [term.trim(), limit, offset, billableOnly]);
    return results;
  }

  /**
   * Get detailed ICD-10 code information
   */
  async getIcd10CodeDetails(code: string, tenantDb: DataSource): Promise<ICD10CodeDetails | null> {
    const masterDb = await this.getMasterDb();
    const query = `
      SELECT 
        code,
        description,
        category,
        category_description,
        billable,
        valid_for_coding,
        includes,
        excludes,
        notes
      FROM icd10_codes
      WHERE code = $1
    `;

    const results = await masterDb.query(query, [code.toUpperCase()]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get ICD-10 codes by category
   */
  async getIcd10ByCategory(category: string, limit: number = 100, tenantDb: DataSource): Promise<ICD10Code[]> {
    const masterDb = await this.getMasterDb();
    const query = `
      SELECT * FROM get_icd10_by_category($1, $2)
    `;

    const results = await masterDb.query(query, [category.toUpperCase(), limit]);
    return results;
  }

  /**
   * Get SNOMED to ICD-10 mappings for a given SNOMED code
   */
  async getSnomedToIcd10Mappings(snomedCode: string, tenantDb: DataSource): Promise<SnomedToIcd10Mapping[]> {
    const masterDb = await this.getMasterDb();
    const query = `
      SELECT 
        m.snomed_code,
        m.snomed_term,
        m.icd10_code,
        ic.description AS icd10_description,
        m.map_category,
        m.correlation,
        m.map_priority
      FROM snomed_to_icd10_map m
      JOIN icd10_codes ic ON m.icd10_code = ic.code
      WHERE m.snomed_code = $1
        AND m.active = true
      ORDER BY m.map_priority ASC, m.correlation ASC
    `;

    const results = await masterDb.query(query, [snomedCode]);
    return results;
  }

  /**
   * Cache ICD-10 search results
   */
  async cacheSearchResults(term: string, limit: number, offset: number, data: any, tenantDb: DataSource): Promise<void> {
    const query = `
      INSERT INTO icd10_search_cache (search_term, result_limit, result_offset, data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (search_term, result_limit, result_offset)
      DO UPDATE SET data = EXCLUDED.data, created_at = NOW()
    `;

    await tenantDb.query(query, [term, limit, offset, JSON.stringify(data)]);
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(term: string, limit: number, offset: number, tenantDb: DataSource): Promise<any | null> {
    const query = `
      SELECT data FROM icd10_search_cache
      WHERE search_term = $1 
        AND result_limit = $2 
        AND result_offset = $3
        AND created_at > NOW() - INTERVAL '7 days'
    `;

    const results = await tenantDb.query(query, [term, limit, offset]);
    return results.length > 0 ? results[0].data : null;
  }
}

