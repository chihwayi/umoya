/**
 * PostgreSQL-based SNOMED CT Terminology Service
 * 
 * This service uses direct PostgreSQL queries instead of Snowstorm,
 * providing reliable, fast SNOMED CT search without external dependencies.
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

@Injectable()
export class TerminologyPostgresService {
  private readonly logger = new Logger(TerminologyPostgresService.name);

  /**
   * Search SNOMED CT concepts using PostgreSQL full-text search
   * @param tenantDb Tenant database connection (or master DB for SNOMED tables)
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

    const searchTerm = term.trim();
    this.logger.debug(`Searching SNOMED CT for: "${searchTerm}"`);

    try {
      // Convert search term to PostgreSQL tsquery format
      // Replace spaces with & (AND operator) and handle special characters
      const tsquery = this.buildTsQuery(searchTerm);

      // Query using full-text search on the materialized view
      const searchQuery = `
        SELECT 
          concept_id,
          term,
          term_type,
          active
        FROM snomed_search_view
        WHERE search_vector @@ to_tsquery('english', $1)
          ${activeOnly ? 'AND active = true' : ''}
        ORDER BY 
          ts_rank(search_vector, to_tsquery('english', $1)) DESC,
          CASE WHEN term_type = 'FSN' THEN 1 ELSE 2 END,
          term
        LIMIT $2
        OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM snomed_search_view
        WHERE search_vector @@ to_tsquery('english', $1)
          ${activeOnly ? 'AND active = true' : ''}
      `;

      // Execute queries
      const [results, countResult] = await Promise.all([
        tenantDb.query(searchQuery, [tsquery, limit, offset]),
        tenantDb.query(countQuery, [tsquery]),
      ]);

      const total = parseInt(countResult[0]?.total || '0', 10);

      // Transform results to SnomedConcept format
      const concepts: SnomedConcept[] = results.map((row: any) => {
        // Get FSN for this concept if available
        const fsn = row.term_type === 'FSN' ? row.term : null;

        return {
          conceptId: row.concept_id,
          term: row.term,
          preferredTerm: row.term_type === 'Synonym' ? row.term : null,
          fullySpecifiedName: fsn,
          active: row.active,
          semanticTag: this.extractSemanticTag(row.term),
        };
      });

      this.logger.debug(`Found ${concepts.length} concepts (total: ${total})`);

      return {
        concepts,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      this.logger.error(`PostgreSQL SNOMED search failed: ${error.message}`, error.stack);
      
      // Fallback to simple ILIKE search if full-text search fails
      return this.fallbackSearch(tenantDb, searchTerm, limit, offset, activeOnly);
    }
  }

  /**
   * Build PostgreSQL tsquery from search term
   * Handles multiple words, special characters, and common patterns
   */
  private buildTsQuery(term: string): string {
    // Clean the term
    let cleaned = term.trim().toLowerCase();

    // Replace special characters that break tsquery
    cleaned = cleaned.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ');

    // Split into words
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      return term; // Fallback to original term
    }

    // For single word, use prefix matching
    if (words.length === 1) {
      return `${words[0]}:*`;
    }

    // For multiple words, use AND operator
    return words.map(w => `${w}:*`).join(' & ');
  }

  /**
   * Fallback search using simple ILIKE pattern matching
   */
  private async fallbackSearch(
    tenantDb: DataSource,
    term: string,
    limit: number,
    offset: number,
    activeOnly: boolean,
  ): Promise<SnomedSearchResult> {
    this.logger.warn(`Using fallback ILIKE search for: "${term}"`);

    const searchPattern = `%${term}%`;
    const searchQuery = `
      SELECT 
        concept_id,
        term,
        term_type,
        active
      FROM snomed_search_view
      WHERE term ILIKE $1
        ${activeOnly ? 'AND active = true' : ''}
      ORDER BY 
        CASE 
          WHEN term ILIKE $2 THEN 1  -- Exact match
          WHEN term ILIKE $3 THEN 2  -- Starts with
          ELSE 3
        END,
        CASE WHEN term_type = 'FSN' THEN 1 ELSE 2 END,
        term
      LIMIT $4
      OFFSET $5
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM snomed_search_view
      WHERE term ILIKE $1
        ${activeOnly ? 'AND active = true' : ''}
    `;

    const [results, countResult] = await Promise.all([
      tenantDb.query(searchQuery, [
        searchPattern,
        term,
        `${term}%`,
        limit,
        offset,
      ]),
      tenantDb.query(countQuery, [searchPattern]),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);

    const concepts: SnomedConcept[] = results.map((row: any) => ({
      conceptId: row.concept_id,
      term: row.term,
      preferredTerm: row.term_type === 'Synonym' ? row.term : null,
      fullySpecifiedName: row.term_type === 'FSN' ? row.term : null,
      active: row.active,
      semanticTag: this.extractSemanticTag(row.term),
    }));

    return {
      concepts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get concept by ID
   */
  async getConceptById(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept | null> {
    if (!conceptId) {
      throw new BadRequestException('Concept ID is required');
    }

    try {
      // Get FSN (Fully Specified Name)
      const fsnQuery = `
        SELECT concept_id, term, active
        FROM snomed_search_view
        WHERE concept_id = $1
          AND term_type = 'FSN'
        LIMIT 1
      `;

      const fsnResult = await tenantDb.query(fsnQuery, [conceptId]);

      if (fsnResult.length === 0) {
        // Try to get any description if FSN not found
        const anyQuery = `
          SELECT concept_id, term, active
          FROM snomed_search_view
          WHERE concept_id = $1
          LIMIT 1
        `;
        const anyResult = await tenantDb.query(anyQuery, [conceptId]);
        
        if (anyResult.length === 0) {
          return null;
        }

        const row = anyResult[0];
        return {
          conceptId: row.concept_id,
          term: row.term,
          fullySpecifiedName: row.term,
          active: row.active,
          semanticTag: this.extractSemanticTag(row.term),
        };
      }

      const row = fsnResult[0];
      return {
        conceptId: row.concept_id,
        term: row.term,
        fullySpecifiedName: row.term,
        active: row.active,
        semanticTag: this.extractSemanticTag(row.term),
      };
    } catch (error: any) {
      this.logger.error(`Failed to get concept ${conceptId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate concept ID and return concept details
   */
  async validateConcept(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept> {
    const concept = await this.getConceptById(tenantDb, conceptId);
    
    if (!concept) {
      throw new NotFoundException(`SNOMED CT concept not found: ${conceptId}`);
    }

    if (!concept.active) {
      throw new BadRequestException(`SNOMED CT concept is inactive: ${conceptId}`);
    }

    return concept;
  }

  /**
   * Extract semantic tag from FSN (Fully Specified Name)
   * Example: "Diabetes mellitus (disorder)" -> "disorder"
   */
  private extractSemanticTag(fsn: string | null | undefined): string | undefined {
    if (!fsn) return undefined;
    
    const match = fsn.match(/\(([^)]+)\)$/);
    return match ? match[1] : undefined;
  }

  /**
   * Get concept details with all descriptions
   */
  async getConceptDetails(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept & { descriptions: Array<{ term: string; type: string }> }> {
    const concept = await this.getConceptById(tenantDb, conceptId);
    
    if (!concept) {
      throw new NotFoundException(`SNOMED CT concept not found: ${conceptId}`);
    }

    // Get all descriptions for this concept
    const descriptionsQuery = `
      SELECT term, term_type
      FROM snomed_search_view
      WHERE concept_id = $1
      ORDER BY 
        CASE term_type
          WHEN 'FSN' THEN 1
          WHEN 'Synonym' THEN 2
          ELSE 3
        END,
        term
    `;

    const descriptions = await tenantDb.query(descriptionsQuery, [conceptId]);

    return {
      ...concept,
      descriptions: descriptions.map((row: any) => ({
        term: row.term,
        type: row.term_type,
      })),
    };
  }

  /**
   * Get child concepts (concepts that have this concept as their parent)
   * Uses the "Is a" relationship (type_id = 116680003)
   */
  async getChildren(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept[]> {
    if (!conceptId) {
      throw new BadRequestException('Concept ID is required');
    }

    try {
      // Get children via "Is a" relationship where this concept is the destination
      const query = `
        SELECT DISTINCT
          c.concept_id,
          d.term,
          c.active
        FROM snomed_relationships r
        JOIN snomed_concepts c ON c.concept_id = r.source_id
        JOIN snomed_descriptions d ON d.concept_id = c.concept_id
        WHERE r.destination_id = $1
          AND r.type_id = '116680003'  -- "Is a" relationship
          AND r.active = true
          AND c.active = true
          AND d.active = true
          AND d.type_id = '900000000000003001'  -- FSN only
          AND d.language_code = 'en'
        ORDER BY d.term
        LIMIT 100
      `;

      const results = await tenantDb.query(query, [conceptId]);

      return results.map((row: any) => ({
        conceptId: row.concept_id,
        term: row.term,
        active: row.active,
        semanticTag: this.extractSemanticTag(row.term),
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get children for concept ${conceptId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get parent concepts (concepts that are parents of this concept)
   * Uses the "Is a" relationship (type_id = 116680003)
   */
  async getParents(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept[]> {
    if (!conceptId) {
      throw new BadRequestException('Concept ID is required');
    }

    try {
      // Get parents via "Is a" relationship where this concept is the source
      const query = `
        SELECT DISTINCT
          c.concept_id,
          d.term,
          c.active
        FROM snomed_relationships r
        JOIN snomed_concepts c ON c.concept_id = r.destination_id
        JOIN snomed_descriptions d ON d.concept_id = c.concept_id
        WHERE r.source_id = $1
          AND r.type_id = '116680003'  -- "Is a" relationship
          AND r.active = true
          AND c.active = true
          AND d.active = true
          AND d.type_id = '900000000000003001'  -- FSN only
          AND d.language_code = 'en'
        ORDER BY d.term
        LIMIT 100
      `;

      const results = await tenantDb.query(query, [conceptId]);

      return results.map((row: any) => ({
        conceptId: row.concept_id,
        term: row.term,
        active: row.active,
        semanticTag: this.extractSemanticTag(row.term),
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get parents for concept ${conceptId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all ancestor concepts (all parents up the hierarchy)
   * Uses recursive CTE to traverse the "Is a" relationship tree
   */
  async getAncestors(
    tenantDb: DataSource,
    conceptId: string,
  ): Promise<SnomedConcept[]> {
    if (!conceptId) {
      throw new BadRequestException('Concept ID is required');
    }

    try {
      // Use recursive CTE to get all ancestors
      const query = `
        WITH RECURSIVE ancestor_tree AS (
          -- Base case: direct parents
          SELECT 
            r.destination_id as concept_id,
            1 as depth
          FROM snomed_relationships r
          WHERE r.source_id = $1
            AND r.type_id = '116680003'  -- "Is a" relationship
            AND r.active = true
          
          UNION ALL
          
          -- Recursive case: parents of parents
          SELECT 
            r.destination_id,
            at.depth + 1
          FROM snomed_relationships r
          JOIN ancestor_tree at ON r.source_id = at.concept_id
          WHERE r.type_id = '116680003'
            AND r.active = true
            AND at.depth < 20  -- Prevent infinite loops
        )
        SELECT DISTINCT
          c.concept_id,
          d.term,
          c.active,
          MIN(at.depth) as depth
        FROM ancestor_tree at
        JOIN snomed_concepts c ON c.concept_id = at.concept_id
        JOIN snomed_descriptions d ON d.concept_id = c.concept_id
        WHERE c.active = true
          AND d.active = true
          AND d.type_id = '900000000000003001'  -- FSN only
          AND d.language_code = 'en'
        GROUP BY c.concept_id, d.term, c.active
        ORDER BY depth, d.term
        LIMIT 500
      `;

      const results = await tenantDb.query(query, [conceptId]);

      return results.map((row: any) => ({
        conceptId: row.concept_id,
        term: row.term,
        active: row.active,
        semanticTag: this.extractSemanticTag(row.term),
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get ancestors for concept ${conceptId}: ${error.message}`);
      throw error;
    }
  }
}


