import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class LabTestCatalogService {
  private readonly logger = new Logger(LabTestCatalogService.name);

  async getAllTests(tenantDb: DataSource, filters: { category?: string; active?: boolean } = {}) {
    const query = `
      SELECT 
        tc.*,
        COUNT(comp.id) as component_count
      FROM lab_test_catalog tc
      LEFT JOIN lab_test_components comp ON comp.test_catalog_id = tc.id
      WHERE 1=1
        ${filters.category ? `AND tc.category = $1` : ''}
        ${filters.active !== undefined ? `AND tc.is_active = $${filters.category ? 2 : 1}` : ''}
      GROUP BY tc.id
      ORDER BY tc.category, tc.test_name
    `;

    const params = [];
    if (filters.category) params.push(filters.category);
    if (filters.active !== undefined) params.push(filters.active);

    const tests = await tenantDb.query(query, params);
    return { tests, total: tests.length };
  }

  async searchTests(tenantDb: DataSource, query: string) {
    const searchQuery = `%${query}%`;
    const tests = await tenantDb.query(
      `
      SELECT 
        tc.*,
        COUNT(comp.id) as component_count
      FROM lab_test_catalog tc
      LEFT JOIN lab_test_components comp ON comp.test_catalog_id = tc.id
      WHERE tc.is_active = true
        AND (
          tc.test_name ILIKE $1
          OR tc.test_code ILIKE $1
          OR tc.loinc_code ILIKE $1
          OR tc.description ILIKE $1
        )
      GROUP BY tc.id
      ORDER BY tc.test_name
      LIMIT 50
      `,
      [searchQuery],
    );

    return { tests, total: tests.length };
  }

  async getCategories(tenantDb: DataSource) {
    const categories = await tenantDb.query(
      `
      SELECT 
        category,
        COUNT(*) as test_count
      FROM lab_test_catalog
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
      `,
    );

    return { categories };
  }

  async getTestById(tenantDb: DataSource, id: string) {
    const test = await tenantDb.query(
      `
      SELECT * FROM lab_test_catalog
      WHERE id = $1
      `,
      [id],
    );

    if (test.length === 0) {
      throw new NotFoundException(`Test with ID ${id} not found`);
    }

    // Get components with reference ranges
    const components = await tenantDb.query(
      `
      SELECT 
        comp.*,
        json_agg(
          json_build_object(
            'id', rr.id,
            'age_min', rr.age_min,
            'age_max', rr.age_max,
            'gender', rr.gender,
            'range_min', rr.range_min,
            'range_max', rr.range_max,
            'range_text', rr.range_text,
            'unit', rr.unit
          ) ORDER BY rr.age_min NULLS FIRST, rr.gender
        ) FILTER (WHERE rr.id IS NOT NULL) as reference_ranges
      FROM lab_test_components comp
      LEFT JOIN lab_reference_ranges rr ON rr.component_id = comp.id
      WHERE comp.test_catalog_id = $1
      GROUP BY comp.id
      ORDER BY comp.sort_order
      `,
      [id],
    );

    return { ...test[0], components };
  }

  async getTestComponents(tenantDb: DataSource, testId: string) {
    const components = await tenantDb.query(
      `
      SELECT 
        comp.*,
        json_agg(
          json_build_object(
            'id', rr.id,
            'age_min', rr.age_min,
            'age_max', rr.age_max,
            'gender', rr.gender,
            'range_min', rr.range_min,
            'range_max', rr.range_max,
            'range_text', rr.range_text,
            'unit', rr.unit
          ) ORDER BY rr.age_min NULLS FIRST, rr.gender
        ) FILTER (WHERE rr.id IS NOT NULL) as reference_ranges
      FROM lab_test_components comp
      LEFT JOIN lab_reference_ranges rr ON rr.component_id = comp.id
      WHERE comp.test_catalog_id = $1
      GROUP BY comp.id
      ORDER BY comp.sort_order
      `,
      [testId],
    );

    return { components };
  }

  async getTestsByCategory(tenantDb: DataSource, category: string) {
    const tests = await tenantDb.query(
      `
      SELECT 
        tc.*,
        COUNT(comp.id) as component_count
      FROM lab_test_catalog tc
      LEFT JOIN lab_test_components comp ON comp.test_catalog_id = tc.id
      WHERE tc.category = $1 AND tc.is_active = true
      GROUP BY tc.id
      ORDER BY tc.test_name
      `,
      [category],
    );

    return { tests, total: tests.length };
  }

  async createTest(tenantDb: DataSource, testData: any) {
    const {
      test_code,
      loinc_code,
      test_name,
      category,
      specimen_type,
      specimen_volume,
      container_type,
      turnaround_time,
      cost,
      description,
      clinical_significance,
    } = testData;

    const result = await tenantDb.query(
      `
      INSERT INTO lab_test_catalog (
        test_code, loinc_code, test_name, category, specimen_type,
        specimen_volume, container_type, turnaround_time, cost,
        description, clinical_significance, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *
      `,
      [
        test_code,
        loinc_code,
        test_name,
        category,
        specimen_type,
        specimen_volume,
        container_type,
        turnaround_time,
        cost,
        description,
        clinical_significance,
      ],
    );

    this.logger.log(`Created lab test: ${test_name} (${test_code})`);
    return result[0];
  }

  async updateTest(tenantDb: DataSource, id: string, testData: any) {
    const {
      loinc_code,
      test_name,
      category,
      specimen_type,
      specimen_volume,
      container_type,
      turnaround_time,
      cost,
      description,
      clinical_significance,
      is_active,
    } = testData;

    const result = await tenantDb.query(
      `
      UPDATE lab_test_catalog
      SET 
        loinc_code = COALESCE($1, loinc_code),
        test_name = COALESCE($2, test_name),
        category = COALESCE($3, category),
        specimen_type = COALESCE($4, specimen_type),
        specimen_volume = COALESCE($5, specimen_volume),
        container_type = COALESCE($6, container_type),
        turnaround_time = COALESCE($7, turnaround_time),
        cost = COALESCE($8, cost),
        description = COALESCE($9, description),
        clinical_significance = COALESCE($10, clinical_significance),
        is_active = COALESCE($11, is_active),
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
      `,
      [
        loinc_code,
        test_name,
        category,
        specimen_type,
        specimen_volume,
        container_type,
        turnaround_time,
        cost,
        description,
        clinical_significance,
        is_active,
        id,
      ],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Test with ID ${id} not found`);
    }

    this.logger.log(`Updated lab test: ${id}`);
    return result[0];
  }

  async deactivateTest(tenantDb: DataSource, id: string) {
    const result = await tenantDb.query(
      `
      UPDATE lab_test_catalog
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Test with ID ${id} not found`);
    }

    this.logger.log(`Deactivated lab test: ${id}`);
    return result[0];
  }

  async addComponent(tenantDb: DataSource, testId: string, componentData: any) {
    const {
      component_name,
      component_code,
      loinc_code,
      unit,
      reference_range_min,
      reference_range_max,
      reference_range_text,
      critical_low,
      critical_high,
      age_specific,
      gender_specific,
      sort_order,
    } = componentData;

    const result = await tenantDb.query(
      `
      INSERT INTO lab_test_components (
        test_catalog_id, component_name, component_code, loinc_code, unit,
        reference_range_min, reference_range_max, reference_range_text,
        critical_low, critical_high, age_specific, gender_specific, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        testId,
        component_name,
        component_code,
        loinc_code,
        unit,
        reference_range_min,
        reference_range_max,
        reference_range_text,
        critical_low,
        critical_high,
        age_specific || false,
        gender_specific || false,
        sort_order || 0,
      ],
    );

    this.logger.log(`Added component ${component_name} to test ${testId}`);
    return result[0];
  }

  async updateComponent(tenantDb: DataSource, componentId: string, componentData: any) {
    const {
      component_name,
      loinc_code,
      unit,
      reference_range_min,
      reference_range_max,
      reference_range_text,
      critical_low,
      critical_high,
      sort_order,
    } = componentData;

    const result = await tenantDb.query(
      `
      UPDATE lab_test_components
      SET 
        component_name = COALESCE($1, component_name),
        loinc_code = COALESCE($2, loinc_code),
        unit = COALESCE($3, unit),
        reference_range_min = COALESCE($4, reference_range_min),
        reference_range_max = COALESCE($5, reference_range_max),
        reference_range_text = COALESCE($6, reference_range_text),
        critical_low = COALESCE($7, critical_low),
        critical_high = COALESCE($8, critical_high),
        sort_order = COALESCE($9, sort_order)
      WHERE id = $10
      RETURNING *
      `,
      [
        component_name,
        loinc_code,
        unit,
        reference_range_min,
        reference_range_max,
        reference_range_text,
        critical_low,
        critical_high,
        sort_order,
        componentId,
      ],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    this.logger.log(`Updated component: ${componentId}`);
    return result[0];
  }

  async addReferenceRange(tenantDb: DataSource, componentId: string, rangeData: any) {
    const { age_min, age_max, gender, range_min, range_max, range_text, unit } = rangeData;

    const result = await tenantDb.query(
      `
      INSERT INTO lab_reference_ranges (
        component_id, age_min, age_max, gender, range_min, range_max, range_text, unit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [componentId, age_min, age_max, gender, range_min, range_max, range_text, unit],
    );

    this.logger.log(`Added reference range for component ${componentId}`);
    return result[0];
  }

  // Helper method to get appropriate reference range for a patient
  async getReferenceRangeForPatient(
    tenantDb: DataSource,
    componentId: string,
    patientAge: number,
    patientGender: string,
  ) {
    const ranges = await tenantDb.query(
      `
      SELECT * FROM lab_reference_ranges
      WHERE component_id = $1
        AND (age_min IS NULL OR age_min <= $2)
        AND (age_max IS NULL OR age_max >= $2)
        AND (gender = $3 OR gender = 'all')
      ORDER BY 
        CASE WHEN gender = $3 THEN 1 ELSE 2 END,
        CASE WHEN age_min IS NOT NULL THEN 1 ELSE 2 END
      LIMIT 1
      `,
      [componentId, patientAge, patientGender],
    );

    return ranges.length > 0 ? ranges[0] : null;
  }
}

