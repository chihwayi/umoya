import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export enum QualityMeasureType {
  HEDIS = 'hedis',
  ECQM = 'ecqm',
  CUSTOM = 'custom',
}

export enum MeasureCategory {
  PREVENTIVE_CARE = 'preventive_care',
  CHRONIC_DISEASE = 'chronic_disease',
  MENTAL_HEALTH = 'mental_health',
  MATERNAL_CHILD = 'maternal_child',
  PATIENT_SAFETY = 'patient_safety',
  CARE_COORDINATION = 'care_coordination',
}

export interface QualityMeasure {
  id: string;
  name: string;
  description: string;
  type: QualityMeasureType;
  category: MeasureCategory;
  numerator: string; // Description of numerator criteria
  denominator: string; // Description of denominator criteria
  exclusions?: string; // Description of exclusion criteria
  nqfNumber?: string; // National Quality Forum number
  cmsId?: string; // CMS measure ID
  version?: string;
  isActive: boolean;
}

export interface MeasureResult {
  measureId: string;
  measureName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  denominator: number;
  numerator: number;
  exclusions: number;
  rate: number; // Percentage (0-100)
  benchmark?: number; // Target rate
  status: 'met' | 'not_met' | 'partial';
  patientList?: {
    numerator: string[]; // Patient IDs in numerator
    denominator: string[]; // Patient IDs in denominator
    exclusions: string[]; // Patient IDs excluded
  };
}

@Injectable()
export class QualityMeasuresService {
  private readonly logger = new Logger(QualityMeasuresService.name);

  // Common HEDIS Measures
  private readonly HEDIS_MEASURES: QualityMeasure[] = [
    {
      id: 'hedis-dm-001',
      name: 'Comprehensive Diabetes Care - HbA1c Control (<8%)',
      description: 'Percentage of patients 18-75 years with diabetes who had HbA1c <8.0% during the measurement year',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients with most recent HbA1c <8.0%',
      denominator: 'Patients 18-75 years with diabetes',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      nqfNumber: '0059',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-dm-002',
      name: 'Comprehensive Diabetes Care - Eye Exam',
      description: 'Percentage of patients 18-75 years with diabetes who received an eye exam',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients who received retinal or dilated eye exam',
      denominator: 'Patients 18-75 years with diabetes',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      nqfNumber: '0055',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-dm-003',
      name: 'Comprehensive Diabetes Care - Nephropathy Screening',
      description: 'Percentage of patients 18-75 years with diabetes who received nephropathy screening',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients who received urine microalbumin test or ACE/ARB prescription',
      denominator: 'Patients 18-75 years with diabetes',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      nqfNumber: '0062',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-bp-001',
      name: 'Controlling High Blood Pressure',
      description: 'Percentage of patients 18-85 years with hypertension who had BP <140/90 mmHg',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients with most recent BP <140/90 mmHg',
      denominator: 'Patients 18-85 years with hypertension',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      nqfNumber: '0018',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-pc-001',
      name: 'Breast Cancer Screening',
      description: 'Percentage of women 50-74 years who received mammography',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.PREVENTIVE_CARE,
      numerator: 'Women who received mammography',
      denominator: 'Women 50-74 years',
      exclusions: 'Women with hospice, advanced illness, or bilateral mastectomy',
      nqfNumber: '2372',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-pc-002',
      name: 'Colorectal Cancer Screening',
      description: 'Percentage of adults 50-75 years who received colorectal cancer screening',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.PREVENTIVE_CARE,
      numerator: 'Patients who received appropriate screening',
      denominator: 'Patients 50-75 years',
      exclusions: 'Patients with hospice, advanced illness, or total colectomy',
      nqfNumber: '0034',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-pc-003',
      name: 'Cervical Cancer Screening',
      description: 'Percentage of women 21-64 years who received cervical cancer screening',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.PREVENTIVE_CARE,
      numerator: 'Women who received Pap test or HPV test',
      denominator: 'Women 21-64 years',
      exclusions: 'Women with hospice, advanced illness, or hysterectomy',
      nqfNumber: '0032',
      version: '2024',
      isActive: true,
    },
    {
      id: 'hedis-im-001',
      name: 'Immunizations for Adolescents',
      description: 'Percentage of adolescents who received recommended immunizations',
      type: QualityMeasureType.HEDIS,
      category: MeasureCategory.PREVENTIVE_CARE,
      numerator: 'Adolescents with complete immunization series',
      denominator: 'Adolescents 13-17 years',
      exclusions: 'None',
      nqfNumber: '0038',
      version: '2024',
      isActive: true,
    },
  ];

  // Common eCQM Measures
  private readonly ECQM_MEASURES: QualityMeasure[] = [
    {
      id: 'ecqm-001',
      name: 'Diabetes: Hemoglobin A1c Poor Control (>9%)',
      description: 'Percentage of patients 18-75 years with diabetes who had HbA1c >9.0%',
      type: QualityMeasureType.ECQM,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients with most recent HbA1c >9.0%',
      denominator: 'Patients 18-75 years with diabetes',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      cmsId: 'CMS122v10',
      version: '2024',
      isActive: true,
    },
    {
      id: 'ecqm-002',
      name: 'Controlling High Blood Pressure',
      description: 'Percentage of patients 18-85 years with hypertension who had BP <140/90 mmHg',
      type: QualityMeasureType.ECQM,
      category: MeasureCategory.CHRONIC_DISEASE,
      numerator: 'Patients with most recent BP <140/90 mmHg',
      denominator: 'Patients 18-85 years with hypertension',
      exclusions: 'Patients with hospice, advanced illness, or pregnancy',
      cmsId: 'CMS165v10',
      version: '2024',
      isActive: true,
    },
    {
      id: 'ecqm-003',
      name: 'Breast Cancer Screening',
      description: 'Percentage of women 50-74 years who received mammography',
      type: QualityMeasureType.ECQM,
      category: MeasureCategory.PREVENTIVE_CARE,
      numerator: 'Women who received mammography',
      denominator: 'Women 50-74 years',
      exclusions: 'Women with hospice, advanced illness, or bilateral mastectomy',
      cmsId: 'CMS125v10',
      version: '2024',
      isActive: true,
    },
  ];

  /**
   * Get all available quality measures
   */
  getAllMeasures(): QualityMeasure[] {
    return [...this.HEDIS_MEASURES, ...this.ECQM_MEASURES].filter((m) => m.isActive);
  }

  /**
   * Get measures by type
   */
  getMeasuresByType(type: QualityMeasureType): QualityMeasure[] {
    return this.getAllMeasures().filter((m) => m.type === type);
  }

  /**
   * Get measures by category
   */
  getMeasuresByCategory(category: MeasureCategory): QualityMeasure[] {
    return this.getAllMeasures().filter((m) => m.category === category);
  }

  /**
   * Get a specific measure by ID
   */
  getMeasureById(measureId: string): QualityMeasure | undefined {
    return this.getAllMeasures().find((m) => m.id === measureId);
  }

  /**
   * Calculate HEDIS Diabetes Care - HbA1c Control
   */
  async calculateDiabetesHbA1cControl(
    tenantDb: DataSource,
    startDate: Date,
    endDate: Date,
  ): Promise<MeasureResult> {
    const measure = this.getMeasureById('hedis-dm-001')!;

    // Denominator: Patients 18-75 years with diabetes
    const [denominatorResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
          OR pr.snomed_concept_id IS NOT NULL
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND p.is_active = true
    `,
    );

    const denominator = denominatorResult?.count || 0;
    const denominatorPatientIds = denominatorResult?.patient_ids || [];

    // Exclusions: Patients with hospice, advanced illness, or pregnancy
    const [exclusionsResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND (
          EXISTS (
            SELECT 1 FROM problems p2
            WHERE p2.patient_id = p.id
              AND (p2.description ILIKE '%hospice%' OR p2.description ILIKE '%terminal%')
          )
          OR EXISTS (
            SELECT 1 FROM problems p3
            WHERE p3.patient_id = p.id
              AND p3.description ILIKE '%pregnancy%'
          )
        )
    `,
    );

    const exclusions = exclusionsResult?.count || 0;
    const exclusionPatientIds = exclusionsResult?.patient_ids || [];

    // Numerator: Patients with most recent HbA1c <8.0%
    // Use a subquery to get the most recent HbA1c for each patient
    const [numeratorResult] = await tenantDb.query(
      `
      WITH latest_hba1c AS (
        SELECT DISTINCT ON (lo.patient_id)
          lo.patient_id,
          (result->>'value')::numeric AS hba1c_value
        FROM lab_orders lo
        CROSS JOIN LATERAL jsonb_array_elements(lo.results) AS result
        WHERE lo.status = 'completed'
          AND lo.created_at BETWEEN $1 AND $2
          AND result->>'testName' IN ('HbA1c', 'Hemoglobin A1c')
          AND (result->>'value')::numeric IS NOT NULL
        ORDER BY lo.patient_id, lo.created_at DESC
      )
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      INNER JOIN latest_hba1c lh ON lh.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND lh.hba1c_value < 8.0
        AND p.id = ANY($3::text[])
        AND p.id != ALL($4::text[])
    `,
      [startDate, endDate, denominatorPatientIds, exclusionPatientIds],
    );

    const numerator = numeratorResult?.count || 0;
    const numeratorPatientIds = numeratorResult?.patient_ids || [];

    const eligibleDenominator = denominator - exclusions;
    const rate = eligibleDenominator > 0 ? (numerator / eligibleDenominator) * 100 : 0;

    return {
      measureId: measure.id,
      measureName: measure.name,
      period: { startDate, endDate },
      denominator: eligibleDenominator,
      numerator,
      exclusions,
      rate: Math.round(rate * 100) / 100,
      benchmark: 75, // HEDIS benchmark
      status: rate >= 75 ? 'met' : rate >= 50 ? 'partial' : 'not_met',
      patientList: {
        numerator: numeratorPatientIds,
        denominator: denominatorPatientIds.filter((id: string) => !exclusionPatientIds.includes(id)),
        exclusions: exclusionPatientIds,
      },
    };
  }

  /**
   * Calculate HEDIS Diabetes Care - Eye Exam
   */
  async calculateDiabetesEyeExam(
    tenantDb: DataSource,
    startDate: Date,
    endDate: Date,
  ): Promise<MeasureResult> {
    const measure = this.getMeasureById('hedis-dm-002')!;

    // Denominator: Patients 18-75 years with diabetes
    const [denominatorResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND p.is_active = true
    `,
    );

    const denominator = denominatorResult?.count || 0;
    const denominatorPatientIds = denominatorResult?.patient_ids || [];

    // Exclusions
    const [exclusionsResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND (
          EXISTS (
            SELECT 1 FROM problems p2
            WHERE p2.patient_id = p.id
              AND (p2.description ILIKE '%hospice%' OR p2.description ILIKE '%terminal%')
          )
          OR EXISTS (
            SELECT 1 FROM problems p3
            WHERE p3.patient_id = p.id
              AND p3.description ILIKE '%pregnancy%'
          )
        )
    `,
    );

    const exclusions = exclusionsResult?.count || 0;
    const exclusionPatientIds = exclusionsResult?.patient_ids || [];

    // Numerator: Patients who received retinal or dilated eye exam
    const [numeratorResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      LEFT JOIN medical_records mr ON mr.patient_id = p.id
      LEFT JOIN lab_orders lo ON lo.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%diabetes%'
          OR pr.snomed_term ILIKE '%diabetes%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 75
        AND (
          (mr.assessment ILIKE '%retinal%' OR mr.assessment ILIKE '%eye exam%' OR mr.assessment ILIKE '%ophthalmology%')
          OR (lo.tests::jsonb @> '[{"testName": "Retinal Exam"}]'::jsonb)
          OR EXISTS (
            SELECT 1 FROM diabetes_complication_screening dcs
            WHERE dcs.patient_id = p.id
              AND dcs.screening_type = 'retinopathy'
              AND dcs.screening_date BETWEEN $1 AND $2
          )
        )
        AND p.id = ANY($3::text[])
        AND p.id != ALL($4::text[])
    `,
      [startDate, endDate, denominatorPatientIds, exclusionPatientIds],
    );

    const numerator = numeratorResult?.count || 0;
    const numeratorPatientIds = numeratorResult?.patient_ids || [];

    const eligibleDenominator = denominator - exclusions;
    const rate = eligibleDenominator > 0 ? (numerator / eligibleDenominator) * 100 : 0;

    return {
      measureId: measure.id,
      measureName: measure.name,
      period: { startDate, endDate },
      denominator: eligibleDenominator,
      numerator,
      exclusions,
      rate: Math.round(rate * 100) / 100,
      benchmark: 60, // HEDIS benchmark
      status: rate >= 60 ? 'met' : rate >= 40 ? 'partial' : 'not_met',
      patientList: {
        numerator: numeratorPatientIds,
        denominator: denominatorPatientIds.filter((id: string) => !exclusionPatientIds.includes(id)),
        exclusions: exclusionPatientIds,
      },
    };
  }

  /**
   * Calculate HEDIS Controlling High Blood Pressure
   */
  async calculateHypertensionControl(
    tenantDb: DataSource,
    startDate: Date,
    endDate: Date,
  ): Promise<MeasureResult> {
    const measure = this.getMeasureById('hedis-bp-001')!;

    // Denominator: Patients 18-85 years with hypertension
    const [denominatorResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%hypertension%'
          OR pr.description ILIKE '%high blood pressure%'
          OR pr.snomed_term ILIKE '%hypertension%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 85
        AND p.is_active = true
    `,
    );

    const denominator = denominatorResult?.count || 0;
    const denominatorPatientIds = denominatorResult?.patient_ids || [];

    // Exclusions
    const [exclusionsResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%hypertension%'
          OR pr.description ILIKE '%high blood pressure%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 85
        AND (
          EXISTS (
            SELECT 1 FROM problems p2
            WHERE p2.patient_id = p.id
              AND (p2.description ILIKE '%hospice%' OR p2.description ILIKE '%terminal%')
          )
          OR EXISTS (
            SELECT 1 FROM problems p3
            WHERE p3.patient_id = p.id
              AND p3.description ILIKE '%pregnancy%'
          )
        )
    `,
    );

    const exclusions = exclusionsResult?.count || 0;
    const exclusionPatientIds = exclusionsResult?.patient_ids || [];

    // Numerator: Patients with most recent BP <140/90 mmHg
    const [numeratorResult] = await tenantDb.query(
      `
      SELECT COUNT(DISTINCT p.id)::int AS count,
             array_agg(DISTINCT p.id::text) AS patient_ids
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      INNER JOIN vitals v ON v.patient_id = p.id
      WHERE pr.status = 'active'
        AND (
          pr.description ILIKE '%hypertension%'
          OR pr.description ILIKE '%high blood pressure%'
        )
        AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 85
        AND v.recorded_at BETWEEN $1 AND $2
        AND v.blood_pressure IS NOT NULL
        AND (
          SELECT (regexp_split_to_array(v.blood_pressure, '/'))[1]::int
        ) < 140
        AND (
          SELECT (regexp_split_to_array(v.blood_pressure, '/'))[2]::int
        ) < 90
        AND v.recorded_at = (
          SELECT MAX(v2.recorded_at)
          FROM vitals v2
          WHERE v2.patient_id = p.id
            AND v2.recorded_at BETWEEN $1 AND $2
        )
        AND p.id = ANY($3::text[])
        AND p.id != ALL($4::text[])
    `,
      [startDate, endDate, denominatorPatientIds, exclusionPatientIds],
    );

    const numerator = numeratorResult?.count || 0;
    const numeratorPatientIds = numeratorResult?.patient_ids || [];

    const eligibleDenominator = denominator - exclusions;
    const rate = eligibleDenominator > 0 ? (numerator / eligibleDenominator) * 100 : 0;

    return {
      measureId: measure.id,
      measureName: measure.name,
      period: { startDate, endDate },
      denominator: eligibleDenominator,
      numerator,
      exclusions,
      rate: Math.round(rate * 100) / 100,
      benchmark: 70, // HEDIS benchmark
      status: rate >= 70 ? 'met' : rate >= 50 ? 'partial' : 'not_met',
      patientList: {
        numerator: numeratorPatientIds,
        denominator: denominatorPatientIds.filter((id: string) => !exclusionPatientIds.includes(id)),
        exclusions: exclusionPatientIds,
      },
    };
  }

  /**
   * Calculate a specific measure
   */
  async calculateMeasure(
    tenantDb: DataSource,
    measureId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MeasureResult> {
    switch (measureId) {
      case 'hedis-dm-001':
        return this.calculateDiabetesHbA1cControl(tenantDb, startDate, endDate);
      case 'hedis-dm-002':
        return this.calculateDiabetesEyeExam(tenantDb, startDate, endDate);
      case 'hedis-bp-001':
        return this.calculateHypertensionControl(tenantDb, startDate, endDate);
      default:
        throw new Error(`Measure ${measureId} not implemented`);
    }
  }

  /**
   * Calculate multiple measures
   */
  async calculateMeasures(
    tenantDb: DataSource,
    measureIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<MeasureResult[]> {
    const results = await Promise.all(
      measureIds.map((measureId) => this.calculateMeasure(tenantDb, measureId, startDate, endDate)),
    );
    return results;
  }

  /**
   * Save measure results to database
   */
  async saveMeasureResult(
    tenantDb: DataSource,
    result: MeasureResult,
    calculatedBy: string,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO quality_measure_results (
        measure_id, measure_name, period_start, period_end,
        denominator, numerator, exclusions, rate, benchmark, status,
        numerator_patients, denominator_patients, exclusion_patients,
        calculated_by, calculated_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9, $10,
        $11::text[], $12::text[], $13::text[],
        $14, NOW(), NOW(), NOW()
      )
    `,
      [
        result.measureId,
        result.measureName,
        result.period.startDate,
        result.period.endDate,
        result.denominator,
        result.numerator,
        result.exclusions,
        result.rate,
        result.benchmark || null,
        result.status,
        result.patientList?.numerator || [],
        result.patientList?.denominator || [],
        result.patientList?.exclusions || [],
        calculatedBy,
      ],
    );
  }

  /**
   * Get measure results history
   */
  async getMeasureResults(
    tenantDb: DataSource,
    filters: {
      measureId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ results: any[]; total: number }> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters.measureId) {
      params.push(filters.measureId);
      conditions.push(`measure_id = $${params.length}`);
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      conditions.push(`period_start >= $${params.length}`);
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      conditions.push(`period_end <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [results, countResult] = await Promise.all([
      tenantDb.query(
        `
        SELECT *
        FROM quality_measure_results
        ${whereClause}
        ORDER BY calculated_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
        [...params, limit, offset],
      ),
      tenantDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM quality_measure_results
        ${whereClause}
      `,
        params,
      ),
    ]);

    return {
      results: results.map(this.formatMeasureResult),
      total: countResult[0]?.total || 0,
    };
  }

  /**
   * Get quality dashboard summary
   */
  async getQualityDashboard(
    tenantDb: DataSource,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const measures = this.getAllMeasures();
    const results = await Promise.all(
      measures.slice(0, 10).map((measure) =>
        this.calculateMeasure(tenantDb, measure.id, startDate, endDate).catch((error) => {
          this.logger.error(`Failed to calculate ${measure.id}: ${error.message}`);
          return null;
        }),
      ),
    );

    const validResults = results.filter((r) => r !== null) as MeasureResult[];

    const summary = {
      period: { startDate, endDate },
      totalMeasures: measures.length,
      calculatedMeasures: validResults.length,
      averageRate: validResults.length > 0
        ? validResults.reduce((sum, r) => sum + r.rate, 0) / validResults.length
        : 0,
      measuresMet: validResults.filter((r) => r.status === 'met').length,
      measuresPartial: validResults.filter((r) => r.status === 'partial').length,
      measuresNotMet: validResults.filter((r) => r.status === 'not_met').length,
      byCategory: this.groupByCategory(validResults),
      results: validResults,
    };

    return summary;
  }

  private groupByCategory(results: MeasureResult[]): Record<string, any> {
    const grouped: Record<string, any> = {};

    results.forEach((result) => {
      const measure = this.getMeasureById(result.measureId);
      if (measure) {
        const category = measure.category;
        if (!grouped[category]) {
          grouped[category] = {
            category,
            count: 0,
            averageRate: 0,
            measures: [],
          };
        }
        grouped[category].count++;
        grouped[category].measures.push(result);
      }
    });

    Object.keys(grouped).forEach((category) => {
      const group = grouped[category];
      group.averageRate =
        group.measures.reduce((sum: number, r: MeasureResult) => sum + r.rate, 0) / group.count;
    });

    return grouped;
  }

  private formatMeasureResult(result: any): any {
    return {
      id: result.id,
      measureId: result.measure_id,
      measureName: result.measure_name,
      period: {
        startDate: result.period_start,
        endDate: result.period_end,
      },
      denominator: result.denominator,
      numerator: result.numerator,
      exclusions: result.exclusions,
      rate: result.rate,
      benchmark: result.benchmark,
      status: result.status,
      patientList: {
        numerator: result.numerator_patients || [],
        denominator: result.denominator_patients || [],
        exclusions: result.exclusion_patients || [],
      },
      calculatedBy: result.calculated_by,
      calculatedAt: result.calculated_at,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }
}

