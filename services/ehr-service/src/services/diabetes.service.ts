import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateDiabetesRegistryDto,
  UpdateDiabetesRegistryDto,
  CreateDiabetesCareBundleDto,
  RecordGlucoseDto,
  CreateCgmSummaryDto,
  CreateDiabetesMedicationDto,
  CreateInsulinRegimenDto,
  RecordComplicationScreeningDto,
  RecordEducationSessionDto,
  CreateDiabetesAlertDto,
  PaginationQueryDto,
  UpdateDiabetesMedicationDto,
  TrackMedicationAdherenceDto,
  UpdateInsulinRegimenDto,
  CalculateInsulinDoseDto,
  GlucoseTrendsQueryDto,
  ScreeningHistoryQueryDto,
} from '../dto/diabetes.dto';

interface RegistryListFilters extends PaginationQueryDto {
  status?: string;
  diabetesType?: string;
  search?: string;
}

@Injectable()
export class DiabetesService {
  private readonly logger = new Logger(DiabetesService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  private registrySelect = `
    SELECT dr.*, p.first_name || ' ' || p.last_name AS patient_name, p.patient_number
    FROM diabetes_registry dr
    INNER JOIN patients p ON p.id = dr.patient_id
  `;

  private careBundleChecklist: Array<{ key: string; label: string }> = [
    { key: 'hba1c_checked', label: 'HbA1c' },
    { key: 'blood_pressure_checked', label: 'Blood pressure' },
    { key: 'lipid_profile_checked', label: 'Lipid profile' },
    { key: 'foot_exam_checked', label: 'Foot exam' },
    { key: 'eye_exam_checked', label: 'Eye exam' },
    { key: 'urine_acr_checked', label: 'Urine ACR' },
    { key: 'diabetes_education_documented', label: 'Education' },
    { key: 'medication_review_completed', label: 'Medication review' },
  ];

  private async getRegistryPatientId(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const [record] = await tenantDb.query(
      `SELECT patient_id FROM diabetes_registry WHERE id = $1`,
      [registryId],
    );
    if (!record) {
      throw new NotFoundException(`Diabetes registry ${registryId} not found`);
    }
    return record.patient_id;
  }

  async listRegistries(
    tenantDb: DataSource,
    filters: RegistryListFilters,
  ) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      where.push(`dr.status = $${params.length + 1}`);
      params.push(filters.status);
    }
    if (filters.diabetesType) {
      where.push(`dr.diabetes_type = $${params.length + 1}`);
      params.push(filters.diabetesType);
    }
    if (filters.search) {
      where.push(`(p.first_name ILIKE $${params.length + 1} OR p.last_name ILIKE $${params.length + 1} OR p.patient_number ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const registries = await tenantDb.query(
      `${this.registrySelect} ${whereClause}
      ORDER BY dr.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM diabetes_registry dr INNER JOIN patients p ON p.id = dr.patient_id ${whereClause}`,
      params.slice(0, params.length - 2),
    );
    return { registries, total: totalResult[0]?.count ?? registries.length };
  }

  async createRegistry(
    tenantDb: DataSource,
    dto: CreateDiabetesRegistryDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const existing = await tenantDb.query(
      'SELECT id FROM diabetes_registry WHERE patient_id = $1',
      [dto.patientId],
    );
    if (existing.length) {
      throw new BadRequestException('Diabetes registry already exists for patient');
    }
    const result = await tenantDb.query(
      `
      INSERT INTO diabetes_registry (
        patient_id, diabetes_type, diabetes_type_snomed_code, diabetes_type_snomed_term,
        diagnosis_date, age_at_diagnosis, status, family_history,
        primary_care_provider_id, endocrinologist_id, diabetes_educator_id,
        care_plan, notes, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'active'),COALESCE($8,false),$9,$10,$11,$12,$13,NOW(),NOW())
      RETURNING *
      `,
      [
        dto.patientId,
        dto.diabetesType,
        null,
        null,
        dto.diagnosisDate,
        dto.ageAtDiagnosis ?? null,
        dto.status ?? 'active',
        dto.familyHistory ?? false,
        dto.primaryCareProviderId ?? null,
        dto.endocrinologistId ?? null,
        dto.diabetesEducatorId ?? null,
        dto.carePlan ?? null,
        dto.notes ?? null,
      ],
    );
    return result[0];
  }

  async getRegistryByPatient(tenantDb: DataSource, patientId: string) {
    this.ensureTenantDb(tenantDb);
    const [registry] = await tenantDb.query(
      `${this.registrySelect} WHERE dr.patient_id = $1`,
      [patientId],
    );
    if (!registry) {
      throw new NotFoundException(`Diabetes registry not found for patient ${patientId}`);
    }
    return registry;
  }

  async updateRegistry(
    tenantDb: DataSource,
    patientId: string,
    dto: UpdateDiabetesRegistryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    const fields: Array<keyof UpdateDiabetesRegistryDto> = [
      'diabetesType',
      'diagnosisDate',
      'ageAtDiagnosis',
      'status',
      'familyHistory',
      'primaryCareProviderId',
      'endocrinologistId',
      'diabetesEducatorId',
      'carePlan',
      'notes',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(patientId);
    const result = await tenantDb.query(
      `UPDATE diabetes_registry SET ${updates.join(', ')}, updated_at = NOW() WHERE patient_id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Diabetes registry not found for patient ${patientId}`);
    }
    return result[0];
  }

  async createCareBundle(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateDiabetesCareBundleDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [bundle] = await tenantDb.query(
      `
      INSERT INTO diabetes_care_bundle (
        diabetes_registry_id, patient_id, bundle_date, hba1c_checked, hba1c_value, hba1c_date,
        blood_pressure_checked, systolic_bp, diastolic_bp, bp_date,
        lipid_profile_checked, lipid_profile_date,
        foot_exam_checked, foot_exam_date, foot_exam_result,
        eye_exam_checked, eye_exam_date, eye_exam_result,
        urine_acr_checked, urine_acr_value, urine_acr_date,
        diabetes_education_documented, education_date,
        medication_review_completed, medication_review_date,
        bundle_completion_percentage, created_at, updated_at
      )
      VALUES (
        $1,$2,COALESCE($3::date,NOW()::date),
        COALESCE($4,false),$5,$6,
        COALESCE($7,false),$8,$9,$10,
        COALESCE($11,false),$12,
        COALESCE($13,false),$14,$15,
        COALESCE($16,false),$17,$18,
        COALESCE($19,false),$20,$21,
        COALESCE($22,false),$23,
        COALESCE($24,false),$25,
        $26,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.bundleDate ?? null,
        dto.hba1cChecked,
        dto.hba1cValue ?? null,
        dto.hba1cDate ?? null,
        dto.bloodPressureChecked,
        dto.systolicBp ?? null,
        dto.diastolicBp ?? null,
        dto.bloodPressureDate ?? null,
        dto.lipidProfileChecked,
        dto.lipidProfileDate ?? null,
        dto.footExamChecked,
        dto.footExamDate ?? null,
        dto.footExamResult ?? null,
        dto.eyeExamChecked,
        dto.eyeExamDate ?? null,
        dto.eyeExamResult ?? null,
        dto.urineAcrChecked,
        dto.urineAcrValue ?? null,
        dto.urineAcrDate ?? null,
        dto.educationDocumented,
        dto.educationDate ?? null,
        dto.medicationReviewCompleted,
        dto.medicationReviewDate ?? null,
        dto.bundleCompletionPercentage ?? null,
      ],
    );
    return bundle;
  }

  async getCareBundleHistory(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `SELECT * FROM diabetes_care_bundle WHERE diabetes_registry_id = $1 ORDER BY bundle_date DESC`,
      [registryId],
    );
  }

  async getLatestCareBundle(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const [bundle] = await tenantDb.query(
      `SELECT * FROM diabetes_care_bundle WHERE diabetes_registry_id = $1 ORDER BY bundle_date DESC LIMIT 1`,
      [registryId],
    );
    return bundle ?? null;
  }

  async calculateCareBundleCompletion(tenantDb: DataSource, registryId: string) {
    const latest = await this.getLatestCareBundle(tenantDb, registryId);
    if (!latest) {
      return {
        bundle: null,
        completionPercentage: null,
        components: this.careBundleChecklist.map((item) => ({
          ...item,
          completed: false,
        })),
      };
    }

    const components = this.careBundleChecklist.map((item) => ({
      ...item,
      completed: Boolean(latest[item.key as keyof typeof latest]),
    }));
    const completed = components.filter((component) => component.completed).length;
    const percentage = latest.bundle_completion_percentage ?? Math.round((completed / components.length) * 100);

    return {
      bundle: latest,
      completionPercentage: percentage,
      components,
    };
  }

  async recordGlucose(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: RecordGlucoseDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [record] = await tenantDb.query(
      `
      INSERT INTO glucose_monitoring (
        diabetes_registry_id, patient_id, monitoring_type, device_type, device_id,
        glucose_value, glucose_unit, reading_type, meal_context,
        insulin_dose, insulin_type, carbohydrates_grams, exercise_minutes,
        stress_level, notes, recorded_at, recorded_by, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,COALESCE($7,'mmol/L'),$8,$9,
        $10,$11,$12,$13,$14,$15,
        COALESCE($16::timestamptz,NOW()),$17,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.monitoringType,
        dto.deviceType ?? null,
        dto.deviceId ?? null,
        dto.glucoseValue,
        dto.glucoseUnit ?? 'mmol/L',
        dto.readingType ?? null,
        dto.mealContext ?? null,
        dto.insulinDose ?? null,
        dto.insulinType ?? null,
        dto.carbohydratesGrams ?? null,
        dto.exerciseMinutes ?? null,
        dto.stressLevel ?? null,
        dto.notes ?? null,
        dto.recordedAt ?? null,
        userId ?? null,
      ],
    );
    return record;
  }

  async getGlucoseHistory(
    tenantDb: DataSource,
    registryId: string,
    query: PaginationQueryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const records = await tenantDb.query(
      `SELECT * FROM glucose_monitoring WHERE diabetes_registry_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [registryId, limit, offset],
    );
    return records;
  }

  async getGlucoseTrends(
    tenantDb: DataSource,
    registryId: string,
    query: GlucoseTrendsQueryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const period = query.period ?? '14d';
    const now = new Date();
    let startDate: Date;
    let endDate: Date = query.endDate ? new Date(query.endDate) : now;

    if (period === 'custom') {
      if (!query.startDate || !query.endDate) {
        throw new BadRequestException('startDate and endDate are required for custom period');
      }
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      const offsets: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
      const days = offsets[period] ?? 14;
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
    }

    const rows = await tenantDb.query(
      `
        SELECT
          date_trunc('day', recorded_at)::date AS day,
          AVG(glucose_value)::numeric(10,2) AS avg_value,
          MIN(glucose_value)::numeric(10,2) AS min_value,
          MAX(glucose_value)::numeric(10,2) AS max_value,
          COUNT(*)::int AS total_readings,
          SUM(CASE WHEN glucose_value < 3.9 THEN 1 ELSE 0 END)::int AS hypo_count,
          SUM(CASE WHEN glucose_value > 10.0 THEN 1 ELSE 0 END)::int AS hyper_count
        FROM glucose_monitoring
        WHERE diabetes_registry_id = $1
          AND recorded_at >= $2
          AND recorded_at <= $3
        GROUP BY day
        ORDER BY day ASC
      `,
      [registryId, startDate.toISOString(), endDate.toISOString()],
    );

    const summary = rows.reduce(
      (acc, row) => {
        acc.totalReadings += Number(row.total_readings);
        acc.hypoCount += Number(row.hypo_count);
        acc.hyperCount += Number(row.hyper_count);
        return acc;
      },
      { totalReadings: 0, hypoCount: 0, hyperCount: 0 },
    );

    return {
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        period,
      },
      summary,
      points: rows,
    };
  }

  async createCgmSummary(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateCgmSummaryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [summary] = await tenantDb.query(
      `
      INSERT INTO cgm_summary (
        diabetes_registry_id, patient_id, summary_date, time_in_range_70_180,
        time_above_range_180, time_below_range_70, time_below_range_54,
        average_glucose, glucose_variability, total_readings,
        device_type, device_id, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()
      )
      ON CONFLICT (diabetes_registry_id, summary_date) DO UPDATE SET
        time_in_range_70_180 = EXCLUDED.time_in_range_70_180,
        time_above_range_180 = EXCLUDED.time_above_range_180,
        time_below_range_70 = EXCLUDED.time_below_range_70,
        time_below_range_54 = EXCLUDED.time_below_range_54,
        average_glucose = EXCLUDED.average_glucose,
        glucose_variability = EXCLUDED.glucose_variability,
        total_readings = EXCLUDED.total_readings,
        device_type = EXCLUDED.device_type,
        device_id = EXCLUDED.device_id,
        updated_at = NOW()
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.summaryDate,
        dto.timeInRange ?? null,
        dto.timeAboveRange ?? null,
        dto.timeBelowRange ?? null,
        dto.timeSevereHypo ?? null,
        dto.averageGlucose ?? null,
        dto.glucoseVariability ?? null,
        dto.totalReadings ?? null,
        dto.deviceType ?? null,
        dto.deviceId ?? null,
      ],
    );
    return summary;
  }

  async getCgmSummaries(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `SELECT * FROM cgm_summary WHERE diabetes_registry_id = $1 ORDER BY summary_date DESC LIMIT 180`,
      [registryId],
    );
  }

  async createMedication(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateDiabetesMedicationDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [medication] = await tenantDb.query(
      `
      INSERT INTO diabetes_medications (
        diabetes_registry_id, patient_id, medication_name, medication_type, medication_category,
        medication_snomed_code, medication_snomed_term, dosage, frequency, route,
        start_date, end_date, status, adherence_percentage, prescribed_by,
        reason_for_discontinuation, notes, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        COALESCE($13,'active'),$14,$15,$16,$17,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.medicationName,
        dto.medicationType,
        dto.medicationCategory ?? null,
        null,
        null,
        dto.dosage,
        dto.frequency,
        dto.route ?? null,
        dto.startDate,
        dto.endDate ?? null,
        dto.status ?? 'active',
        dto.adherencePercentage ?? null,
        dto.prescribedBy ?? userId ?? null,
        dto.reasonForDiscontinuation ?? null,
        dto.notes ?? null,
      ],
    );
    return medication;
  }

  async listMedications(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `SELECT * FROM diabetes_medications WHERE diabetes_registry_id = $1 ORDER BY updated_at DESC`,
      [registryId],
    );
  }

  async updateMedication(
    tenantDb: DataSource,
    medicationId: string,
    dto: UpdateDiabetesMedicationDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${this.camelToSnake(key)} = $${params.length + 1}`);
        params.push(value);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(medicationId);
    const [updated] = await tenantDb.query(
      `UPDATE diabetes_medications SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!updated) {
      throw new NotFoundException(`Medication ${medicationId} not found`);
    }
    return updated;
  }

  async trackMedicationAdherence(
    tenantDb: DataSource,
    medicationId: string,
    dto: TrackMedicationAdherenceDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [updated] = await tenantDb.query(
      `
        UPDATE diabetes_medications
        SET adherence_percentage = $2,
            notes = CASE WHEN $3 IS NULL THEN notes ELSE CONCAT(COALESCE(notes,''), '\nAdherence update: ', $3) END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [medicationId, dto.adherencePercentage, dto.notes ?? null],
    );
    if (!updated) {
      throw new NotFoundException(`Medication ${medicationId} not found`);
    }
    return updated;
  }

  async createInsulinRegimen(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateInsulinRegimenDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [regimen] = await tenantDb.query(
      `
      INSERT INTO insulin_regimens (
        diabetes_registry_id, patient_id, regimen_type, basal_insulin_type, basal_dose,
        basal_frequency, bolus_insulin_type, bolus_ratio, correction_factor,
        target_glucose, carb_ratio, pump_settings, start_date, end_date,
        status, notes, created_by, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        COALESCE($15,'active'),$16,$17,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.regimenType,
        dto.basalInsulinType ?? null,
        dto.basalDose ?? null,
        dto.basalFrequency ?? null,
        dto.bolusInsulinType ?? null,
        dto.bolusRatio ?? null,
        dto.correctionFactor ?? null,
        dto.targetGlucose ?? null,
        dto.carbRatio ?? null,
        dto.pumpSettings ?? {},
        dto.startDate,
        dto.endDate ?? null,
        dto.status ?? 'active',
        dto.notes ?? null,
        userId ?? null,
      ],
    );
    return regimen;
  }

  async updateInsulinRegimen(
    tenantDb: DataSource,
    regimenId: string,
    dto: UpdateInsulinRegimenDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${this.camelToSnake(key)} = $${params.length + 1}`);
        params.push(value);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(regimenId);
    const [updated] = await tenantDb.query(
      `UPDATE insulin_regimens SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!updated) {
      throw new NotFoundException(`Insulin regimen ${regimenId} not found`);
    }
    return updated;
  }

  async getActiveRegimen(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const [regimen] = await tenantDb.query(
      `
        SELECT *
        FROM insulin_regimens
        WHERE diabetes_registry_id = $1
        ORDER BY (status = 'active') DESC, start_date DESC
        LIMIT 1
      `,
      [registryId],
    );
    return regimen ?? null;
  }

  async calculateInsulinDose(
    tenantDb: DataSource,
    regimenId: string,
    dto: CalculateInsulinDoseDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [regimen] = await tenantDb.query(`SELECT * FROM insulin_regimens WHERE id = $1`, [regimenId]);
    if (!regimen) {
      throw new NotFoundException(`Insulin regimen ${regimenId} not found`);
    }

    const carbRatio = dto.carbRatioOverride ?? regimen.carb_ratio ?? null;
    const correctionFactor = dto.correctionFactorOverride ?? regimen.correction_factor ?? null;
    const targetGlucose = dto.targetGlucose ?? regimen.target_glucose ?? 6.0;

    if (!carbRatio || !correctionFactor) {
      throw new BadRequestException('Regimen is missing carb ratio or correction factor');
    }

    const carbDose = dto.carbohydrateIntake / carbRatio;
    const correctionDose = (dto.currentGlucose - targetGlucose) / correctionFactor;
    const totalDose = Number((carbDose + Math.max(correctionDose, 0)).toFixed(2));

    return {
      regimenId,
      recommendedUnits: totalDose,
      components: {
        carbDose: Number(carbDose.toFixed(2)),
        correctionDose: Number(Math.max(correctionDose, 0).toFixed(2)),
      },
      targetGlucose,
    };
  }

  async recordScreening(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: RecordComplicationScreeningDto,
    providerId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [screening] = await tenantDb.query(
      `
      INSERT INTO diabetes_complication_screening (
        diabetes_registry_id, patient_id, screening_type, screening_date,
        screening_result, screening_result_snomed_code, screening_result_snomed_term,
        severity_grade, findings, treatment_recommended, treatment_plan,
        next_screening_due_date, performed_by, reviewed_by, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,null,null,$6,$7,COALESCE($8,false),$9,$10,$11,$12,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.screeningType,
        dto.screeningDate,
        dto.screeningResult ?? null,
        dto.severityGrade ?? null,
        dto.findings ?? null,
        dto.treatmentRecommended ?? false,
        dto.treatmentPlan ?? null,
        dto.nextScreeningDueDate ?? null,
        providerId ?? null,
        providerId ?? null,
      ],
    );
    return screening;
  }

  async getScreeningHistory(
    tenantDb: DataSource,
    registryId: string,
    query: ScreeningHistoryQueryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const params: any[] = [registryId];
    const conditions: string[] = ['diabetes_registry_id = $1'];
    if (query.screeningType) {
      conditions.push(`screening_type = $2`);
      params.push(query.screeningType);
    }
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 25;
    params.push(limit, offset);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    return tenantDb.query(
      `SELECT * FROM diabetes_complication_screening ${whereClause} ORDER BY screening_date DESC LIMIT $${
        params.length - 1
      } OFFSET $${params.length}`,
      params,
    );
  }

  async getUpcomingScreenings(
    tenantDb: DataSource,
    registryId: string,
  ) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `
        SELECT *
        FROM diabetes_complication_screening
        WHERE diabetes_registry_id = $1
          AND next_screening_due_date IS NOT NULL
          AND next_screening_due_date <= NOW()::date + INTERVAL '180 days'
        ORDER BY next_screening_due_date ASC
      `,
      [registryId],
    );
  }

  async checkScreeningDue(
    tenantDb: DataSource,
    registryId: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const screeningTypes = ['retinopathy', 'neuropathy', 'nephropathy', 'cardiovascular', 'foot_ulcer'];
    const results = [];
    for (const type of screeningTypes) {
      const [row] = await tenantDb.query(
        `
          SELECT screening_date, next_screening_due_date
          FROM diabetes_complication_screening
          WHERE diabetes_registry_id = $1 AND screening_type = $2
          ORDER BY screening_date DESC
          LIMIT 1
        `,
        [registryId, type],
      );
      const nextDue =
        row?.next_screening_due_date ??
        (row?.screening_date
          ? new Date(new Date(row.screening_date).getTime() + 365 * 24 * 60 * 60 * 1000)
          : null);
      const overdue = nextDue ? new Date(nextDue) < new Date() : true;
      results.push({
        screeningType: type,
        lastScreeningDate: row?.screening_date ?? null,
        nextScreeningDueDate: nextDue ? new Date(nextDue).toISOString() : null,
        overdue,
      });
    }
    return results;
  }

  async recordEducationSession(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: RecordEducationSessionDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [session] = await tenantDb.query(
      `
      INSERT INTO diabetes_education_sessions (
        diabetes_registry_id, patient_id, session_date, session_type,
        topics_covered, educator_id, patient_attendance, completion_status,
        assessment_score, notes, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,COALESCE($7,true),COALESCE($8,'completed'),
        $9,$10,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.sessionDate,
        dto.sessionType,
        dto.topicsCovered ?? [],
        dto.educatorId ?? null,
        dto.patientAttendance ?? true,
        dto.completionStatus ?? 'completed',
        dto.assessmentScore ?? null,
        dto.notes ?? null,
      ],
    );
    return session;
  }

  async getEducationHistory(
    tenantDb: DataSource,
    registryId: string,
    query: PaginationQueryDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 25;
    return tenantDb.query(
      `
        SELECT *
        FROM diabetes_education_sessions
        WHERE diabetes_registry_id = $1
        ORDER BY session_date DESC
        LIMIT $2 OFFSET $3
      `,
      [registryId, limit, offset],
    );
  }

  async checkEducationDue(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const [latest] = await tenantDb.query(
      `
        SELECT session_date
        FROM diabetes_education_sessions
        WHERE diabetes_registry_id = $1
        ORDER BY session_date DESC
        LIMIT 1
      `,
      [registryId],
    );
    if (!latest) {
      return { overdue: true, reason: 'No documented education session' };
    }
    const lastDate = new Date(latest.session_date);
    const nextDue = new Date(lastDate);
    nextDue.setFullYear(nextDue.getFullYear() + 1);
    return {
      overdue: nextDue < new Date(),
      lastSessionDate: lastDate.toISOString(),
      nextDueDate: nextDue.toISOString(),
    };
  }

  async createAlert(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateDiabetesAlertDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [alert] = await tenantDb.query(
      `
      INSERT INTO diabetes_alerts (
        diabetes_registry_id, patient_id, alert_type, alert_severity,
        alert_message, related_metric, related_value, related_date,
        acknowledged, acknowledged_by, resolved, resolved_by,
        resolution_notes, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,false,null,false,null,null,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.alertType,
        dto.alertSeverity,
        dto.alertMessage,
        dto.relatedMetric ?? null,
        dto.relatedValue ?? null,
        dto.relatedDate ?? null,
      ],
    );
    return alert;
  }

  async syncVitalsGlucose(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const patientId = await this.getRegistryPatientId(tenantDb, registryId);
    const [lastSynced] = await tenantDb.query(
      `
        SELECT MAX(recorded_at) AS last_recorded
        FROM glucose_monitoring
        WHERE diabetes_registry_id = $1
          AND monitoring_type = 'vitals'
      `,
      [registryId],
    );
    const vitals = await tenantDb.query(
      `
        SELECT id, blood_glucose, recorded_at, recorded_by
        FROM vitals
        WHERE patient_id = $1
          AND blood_glucose IS NOT NULL
          AND (
            $2::timestamptz IS NULL
            OR recorded_at > $2::timestamptz
          )
        ORDER BY recorded_at ASC
        LIMIT 60
      `,
      [patientId, lastSynced?.last_recorded ?? null],
    );
    if (!vitals.length) {
      return { inserted: 0 };
    }
    for (const vital of vitals) {
      await tenantDb.query(
        `
          INSERT INTO glucose_monitoring (
            diabetes_registry_id, patient_id, monitoring_type, device_type, device_id,
            glucose_value, glucose_unit, reading_type, meal_context,
            insulin_dose, insulin_type, carbohydrates_grams, exercise_minutes,
            stress_level, notes, recorded_at, recorded_by, created_at, updated_at
          )
          VALUES (
            $1,$2,'vitals','point_of_care',$3,
            $4,'mmol/L',NULL,NULL,
            NULL,NULL,NULL,NULL,
            NULL,$5,$6,$7,NOW(),NOW()
          )
        `,
        [
          registryId,
          patientId,
          `vitals:${vital.id}`,
          Number(vital.blood_glucose),
          `Imported from vitals ${vital.id}`,
          vital.recorded_at,
          vital.recorded_by ?? null,
        ],
      );
    }
    this.logger.log(`Synced ${vitals.length} vitals-derived glucose readings for registry ${registryId}`);
    return { inserted: vitals.length };
  }

  async syncCareBundleFromLabs(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const patientId = await this.getRegistryPatientId(tenantDb, registryId);
    const labs = await tenantDb.query(
      `
        SELECT id, test_name, result_value, result_unit, reference_range, completed_at, ordered_at
        FROM lab_results
        WHERE patient_id = $1
          AND status = 'completed'
        ORDER BY COALESCE(completed_at, ordered_at) DESC NULLS LAST
        LIMIT 40
      `,
      [patientId],
    );
    if (!labs.length) {
      return { updated: false };
    }
    let bundle = await this.getLatestCareBundle(tenantDb, registryId);
    if (!bundle) {
      await tenantDb.query(
        `
          INSERT INTO diabetes_care_bundle (diabetes_registry_id, patient_id, bundle_date, created_at, updated_at)
          VALUES ($1,$2,NOW()::date,NOW(),NOW())
          ON CONFLICT DO NOTHING
        `,
        [registryId, patientId],
      );
      bundle = await this.getLatestCareBundle(tenantDb, registryId);
    }
    if (!bundle) {
      return { updated: false };
    }

    const findLab = (terms: string[]) => {
      const normalized = labs.map((lab: any) => ({
        ...lab,
        normalized: (lab.test_name ?? '').toLowerCase(),
      }));
      return normalized.find((lab) => terms.some((term) => lab.normalized.includes(term)));
    };

    const updates: string[] = [];
    const params: any[] = [];
    const queue = (column: string, value: any) => {
      updates.push(`${column} = $${params.length + 1}`);
      params.push(value);
    };

    const hba1cLab = findLab(['hba1c', 'glycated', 'hemoglobin a1c']);
    if (hba1cLab) {
      queue('hba1c_checked', true);
      queue('hba1c_value', this.parseLabNumber(hba1cLab.result_value));
      queue('hba1c_date', hba1cLab.completed_at ?? hba1cLab.ordered_at);
    }

    const lipidLab = findLab(['ldl', 'lipid', 'cholesterol']);
    if (lipidLab) {
      queue('lipid_profile_checked', true);
      queue('lipid_profile_date', lipidLab.completed_at ?? lipidLab.ordered_at);
    }

    const acrLab = findLab(['acr', 'albumin', 'microalbumin']);
    if (acrLab) {
      queue('urine_acr_checked', true);
      queue('urine_acr_value', this.parseLabNumber(acrLab.result_value));
      queue('urine_acr_date', acrLab.completed_at ?? acrLab.ordered_at);
    }

    if (!updates.length) {
      return { updated: false };
    }
    params.push(registryId);
    await tenantDb.query(
      `
        UPDATE diabetes_care_bundle
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE diabetes_registry_id = $${params.length}
      `,
      params,
    );
    await this.calculateCareBundleCompletion(tenantDb, registryId);
    this.logger.log(`Updated diabetes care bundle with lab integrations for registry ${registryId}`);
    return { updated: true };
  }

  async syncMedicationsFromPrescriptions(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    const patientId = await this.getRegistryPatientId(tenantDb, registryId);
    const prescriptions = await tenantDb.query(
      `
        SELECT id, medication_name, dosage, frequency, duration, medication_name_snomed_code,
               medication_name_snomed_term, prescribed_at, doctor_id, instructions
        FROM prescriptions
        WHERE patient_id = $1
          AND (is_active = true OR status = 'active')
        ORDER BY prescribed_at DESC NULLS LAST
        LIMIT 15
      `,
      [patientId],
    );
    if (!prescriptions.length) {
      return { inserted: 0 };
    }
    const existing = await tenantDb.query(
      `
        SELECT medication_name, start_date
        FROM diabetes_medications
        WHERE diabetes_registry_id = $1
      `,
      [registryId],
    );
    const existingKeys = new Set(
      existing.map(
        (row: any) => `${(row.medication_name ?? '').toLowerCase()}|${row.start_date ?? ''}`,
      ),
    );
    let inserted = 0;
    for (const rx of prescriptions) {
      const key = `${(rx.medication_name ?? '').toLowerCase()}|${(rx.prescribed_at ?? '')
        .toString()
        .slice(0, 10)}`;
      if (existingKeys.has(key)) {
        continue;
      }
      existingKeys.add(key);
      const medType = (rx.medication_name || '').toLowerCase().includes('insulin')
        ? 'insulin'
        : 'oral';
      const route = medType === 'insulin' ? 'subcutaneous' : 'oral';
      const category = this.mapMedicationCategory(rx.medication_name || '');
      await tenantDb.query(
        `
          INSERT INTO diabetes_medications (
            diabetes_registry_id, patient_id, medication_name, medication_type, medication_category,
            medication_snomed_code, medication_snomed_term,
            dosage, frequency, route, start_date, status,
            adherence_percentage, prescribed_by, notes, created_at, updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,
            $8,$9,$10,$11,'active',
            90,$12,$13,NOW(),NOW()
          )
        `,
        [
          registryId,
          patientId,
          rx.medication_name,
          medType,
          category,
          rx.medication_name_snomed_code ?? null,
          rx.medication_name_snomed_term ?? null,
          rx.dosage,
          rx.frequency,
          route,
          (rx.prescribed_at ?? new Date()).toISOString().slice(0, 10),
          rx.doctor_id ?? null,
          rx.instructions ?? 'Imported from prescription record',
        ],
      );
      inserted += 1;
    }
    if (inserted) {
      this.logger.log(`Synchronized ${inserted} prescriptions into diabetes medications for ${registryId}`);
    }
    return { inserted };
  }

  async getDashboardSummary(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);
    const [totals] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_registries,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_cases,
        COUNT(*) FILTER (WHERE status = 'in_remission')::int AS in_remission,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_cases
      FROM diabetes_registry
      `,
    );
    const alerts = await tenantDb.query(
      `
      SELECT alert_severity, COUNT(*)::int AS count
      FROM diabetes_alerts
      WHERE resolved = false
      GROUP BY alert_severity
      `,
    );
    const upcomingScreenings = await tenantDb.query(
      `
      SELECT dcs.*, p.first_name || ' ' || p.last_name AS patient_name
      FROM diabetes_complication_screening dcs
      INNER JOIN patients p ON p.id = dcs.patient_id
      WHERE dcs.next_screening_due_date IS NOT NULL
        AND dcs.next_screening_due_date <= NOW()::date + INTERVAL '30 days'
      ORDER BY dcs.next_screening_due_date ASC
      LIMIT 20
      `,
    );
    return {
      totals: totals || {},
      alerts,
      upcomingScreenings,
      recentVitals: await tenantDb.query(
        `
          SELECT patient_id, blood_glucose, blood_pressure, heart_rate, recorded_at
          FROM vitals
          WHERE blood_glucose IS NOT NULL
          ORDER BY recorded_at DESC
          LIMIT 12
        `,
      ),
      labHighlights: await tenantDb.query(
        `
          SELECT patient_id, test_name, result_value, result_unit, reference_range, completed_at
          FROM lab_results
          WHERE status = 'completed'
            AND (
              test_name ILIKE '%hba1c%'
              OR test_name ILIKE '%ldl%'
              OR test_name ILIKE '%lipid%'
              OR test_name ILIKE '%albumin%'
              OR test_name ILIKE '%acr%'
            )
          ORDER BY COALESCE(completed_at, ordered_at) DESC NULLS LAST
          LIMIT 25
        `,
      ),
      medicationAdherence: (
        await tenantDb.query(
          `
            SELECT
              AVG(adherence_percentage)::numeric(5,2) AS avg_adherence,
              COUNT(*) FILTER (WHERE adherence_percentage < 80) AS below_target,
              COUNT(*) AS total_medications,
              COUNT(*) FILTER (WHERE status = 'active') AS active_medications
            FROM diabetes_medications
          `,
        )
      )[0] || {},
      deviceStats: (
        await tenantDb.query(
          `
            SELECT
              COUNT(*)::int AS total_devices,
              COUNT(*) FILTER (WHERE integration_status = 'active')::int AS active_devices
            FROM diabetes_device_integration
          `,
        )
      )[0] || {},
    };
  }

  private camelToSnake(value: string) {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private parseLabNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private mapMedicationCategory(name: string): string {
    const normalized = (name || '').toLowerCase();
    if (normalized.includes('metformin')) return 'metformin';
    if (normalized.includes('gliflozin') || normalized.includes('sglt2')) return 'sglt2_inhibitor';
    if (normalized.includes('gliptin') || normalized.includes('dpp4')) return 'dpp4_inhibitor';
    if (normalized.includes('semaglutide') || normalized.includes('liraglutide') || normalized.includes('glp')) return 'glp1_agonist';
    if (normalized.includes('insulin') && normalized.includes('bolus')) return 'insulin_bolus';
    if (normalized.includes('insulin')) return 'insulin_basal';
    if (normalized.includes('sulfonylurea') || normalized.includes('glyburide') || normalized.includes('glipizide')) return 'sulfonylurea';
    if (normalized.includes('thiazolidinedione') || normalized.includes('pioglitazone')) return 'thiazolidinedione';
    return 'other';
  }
}


