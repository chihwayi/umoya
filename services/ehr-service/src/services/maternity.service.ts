import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TerminologyService } from './terminology.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

export interface MaternityPrecheckIssue {
  code: string;
  field?: string;
  message: string;
  guideline_reference?: string;
}

export interface MaternityPrecheckTrace {
  rule_id: string;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface MaternityPrecheckResponse {
  blockers: MaternityPrecheckIssue[];
  warnings: MaternityPrecheckIssue[];
  required_actions: string[];
  suggested_orders: string[];
  doctor_escalation_required: boolean;
  trace: MaternityPrecheckTrace[];
}

type MaternityCareTaskStatus = 'open' | 'acknowledged' | 'actioned' | 'closed';
type MaternityCareTaskPriority = 'low' | 'medium' | 'high' | 'critical';
type MaternityCareTaskSource =
  | 'anc_visit'
  | 'delivery'
  | 'postnatal_visit'
  | 'risk_factor'
  | 'manual';

interface MaternityCareTaskFilters {
  status?: MaternityCareTaskStatus;
  priority?: MaternityCareTaskPriority;
  enrollmentId?: string;
}

@Injectable()
export class MaternityService {
  private readonly logger = new Logger(MaternityService.name);

  constructor(private readonly terminologyService: TerminologyService) {}

  private parseDate(raw: any): Date | null {
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private normalizeToDateOnly(raw: any): Date | null {
    const parsed = this.parseDate(raw);
    if (!parsed) {
      return null;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private normalizeString(raw: any): string | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    const normalized = String(raw).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeBoolean(raw: any): boolean {
    if (typeof raw === 'string') {
      return raw === 'true';
    }
    return Boolean(raw);
  }

  private assertPrecheckAllowsPersistence(
    precheck: MaternityPrecheckResponse,
    warningsAcknowledged: any,
    contextLabel: string,
  ): void {
    const blockers = Array.isArray(precheck?.blockers) ? precheck.blockers : [];
    const warnings = Array.isArray(precheck?.warnings) ? precheck.warnings : [];

    if (blockers.length > 0) {
      throw new BadRequestException(
        `${contextLabel} blocked: ${blockers[0]?.message || 'Safety validation failed.'}`,
      );
    }

    if (warnings.length > 0 && !this.normalizeBoolean(warningsAcknowledged)) {
      throw new BadRequestException(
        `${contextLabel} has safety warnings that must be acknowledged before saving.`,
      );
    }
  }

  private deriveCareTaskPriority(precheck: MaternityPrecheckResponse): MaternityCareTaskPriority {
    if ((precheck.blockers?.length ?? 0) > 0) {
      return 'critical';
    }

    const highSignal = [...(precheck.trace ?? []), ...(precheck.warnings ?? [])].some((item: any) => {
      const text = `${item?.rule_id || ''} ${item?.code || ''} ${item?.message || ''}`.toLowerCase();
      return (
        text.includes('severe') ||
        text.includes('death') ||
        text.includes('hemorrhage') ||
        text.includes('eclamps') ||
        text.includes('urgent')
      );
    });

    return highSignal ? 'critical' : 'high';
  }

  private async upsertMaternityCareTask(
    tenantDb: DataSource,
    input: {
      enrollmentId: string;
      patientId: string;
      sourceType: MaternityCareTaskSource;
      sourceRecordId?: string | null;
      createdBy?: string | null;
      title: string;
      summary?: string | null;
      priority: MaternityCareTaskPriority;
      blockerCount?: number;
      warningCount?: number;
      requiredActions?: string[];
      suggestedOrders?: string[];
      ruleTrace?: MaternityPrecheckTrace[];
      taskContext?: Record<string, any>;
    },
  ) {
    const sourceRecordId = this.normalizeString(input.sourceRecordId);
    const existingTask =
      sourceRecordId
        ? await tenantDb.query(
            `
            SELECT id
            FROM maternity_care_tasks
            WHERE source_type = $1
              AND source_record_id = $2
              AND status IN ('open', 'acknowledged', 'actioned')
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [input.sourceType, sourceRecordId],
          )
        : [];

    const payload = [
      input.priority,
      input.title,
      input.summary || null,
      input.blockerCount || 0,
      input.warningCount || 0,
      JSON.stringify(input.requiredActions ?? []),
      JSON.stringify(input.suggestedOrders ?? []),
      JSON.stringify(input.ruleTrace ?? []),
      JSON.stringify(input.taskContext ?? {}),
    ];

    if (existingTask.length > 0) {
      const updated = await tenantDb.query(
        `
        UPDATE maternity_care_tasks
        SET priority = $1,
            title = $2,
            summary = $3,
            blocker_count = $4,
            warning_count = $5,
            required_actions = $6::jsonb,
            suggested_orders = $7::jsonb,
            rule_trace = $8::jsonb,
            task_context = $9::jsonb,
            last_event_at = NOW(),
            updated_at = NOW()
        WHERE id = $10
        RETURNING *
        `,
        [...payload, existingTask[0].id],
      );
      return updated[0];
    }

    const inserted = await tenantDb.query(
      `
      INSERT INTO maternity_care_tasks (
        maternity_enrollment_id,
        patient_id,
        source_type,
        source_record_id,
        status,
        priority,
        title,
        summary,
        blocker_count,
        warning_count,
        required_actions,
        suggested_orders,
        rule_trace,
        task_context,
        created_by,
        last_event_at
      )
      VALUES (
        $1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, NOW()
      )
      RETURNING *
      `,
      [
        input.enrollmentId,
        input.patientId,
        input.sourceType,
        sourceRecordId,
        ...payload,
        input.createdBy || null,
      ],
    );

    return inserted[0];
  }

  private async createEscalationTaskFromPrecheck(
    tenantDb: DataSource,
    input: {
      enrollmentId: string;
      patientId: string;
      sourceType: MaternityCareTaskSource;
      sourceRecordId: string;
      createdBy?: string | null;
      title: string;
      summary: string;
      precheck: MaternityPrecheckResponse;
      taskContext?: Record<string, any>;
    },
  ) {
    if (!input.precheck?.doctor_escalation_required) {
      return null;
    }

    return this.upsertMaternityCareTask(tenantDb, {
      enrollmentId: input.enrollmentId,
      patientId: input.patientId,
      sourceType: input.sourceType,
      sourceRecordId: input.sourceRecordId,
      createdBy: input.createdBy,
      title: input.title,
      summary: input.summary,
      priority: this.deriveCareTaskPriority(input.precheck),
      blockerCount: input.precheck.blockers?.length ?? 0,
      warningCount: input.precheck.warnings?.length ?? 0,
      requiredActions: input.precheck.required_actions ?? [],
      suggestedOrders: input.precheck.suggested_orders ?? [],
      ruleTrace: input.precheck.trace ?? [],
      taskContext: {
        doctorEscalationRequired: true,
        ...(input.taskContext ?? {}),
      },
    });
  }

  private async validateVitalsProvenanceForPersistence(
    tenantDb: DataSource,
    options: {
      patientId: string;
      visitDate: string;
      context: 'anc' | 'postnatal';
      sourceVitalId?: any;
      autoPopulatedAt?: any;
      overridden?: any;
      overrideReason?: any;
    },
  ): Promise<{
    sourceVitalId: string | null;
    autoPopulatedAt: string | null;
    overridden: boolean;
    overrideReason: string | null;
  }> {
    const sourceVitalId = this.normalizeString(options.sourceVitalId);
    const overrideReason = this.normalizeString(options.overrideReason);
    const overridden = this.normalizeBoolean(options.overridden) || Boolean(overrideReason);
    const contextLabel = options.context === 'anc' ? 'ANC' : 'Postnatal';

    if (overridden && !overrideReason) {
      throw new BadRequestException(
        `${contextLabel} vitals override reason is required when auto-populated vitals are edited.`,
      );
    }
    if (overridden && !sourceVitalId) {
      throw new BadRequestException(
        `${contextLabel} vitals override requires a source vital record reference.`,
      );
    }

    if (!sourceVitalId) {
      return {
        sourceVitalId: null,
        autoPopulatedAt: null,
        overridden: false,
        overrideReason: null,
      };
    }

    const sourceRows = await tenantDb.query(
      `SELECT id, patient_id, recorded_at, created_at FROM vitals WHERE id = $1 LIMIT 1`,
      [sourceVitalId],
    );
    if (sourceRows.length === 0) {
      throw new BadRequestException(`${contextLabel} vitals source record was not found.`);
    }

    const sourceVital = sourceRows[0];
    if (options.patientId && sourceVital.patient_id !== options.patientId) {
      throw new BadRequestException(
        `${contextLabel} vitals source does not belong to the selected patient.`,
      );
    }

    const sourceDate = this.normalizeToDateOnly(sourceVital.recorded_at || sourceVital.created_at);
    const visitDate = this.normalizeToDateOnly(options.visitDate);
    if (
      sourceDate &&
      visitDate &&
      sourceDate.getTime() !== visitDate.getTime()
    ) {
      throw new BadRequestException(
        `${contextLabel} vitals source must be captured on the same date as the visit.`,
      );
    }

    const parsedAutoPopulatedAt = this.parseDate(options.autoPopulatedAt);
    const autoPopulatedAt = parsedAutoPopulatedAt
      ? parsedAutoPopulatedAt.toISOString()
      : new Date().toISOString();

    return {
      sourceVitalId,
      autoPopulatedAt,
      overridden,
      overrideReason: overridden ? overrideReason : null,
    };
  }

  private createPrecheckResponse(
    blockers: MaternityPrecheckIssue[],
    warnings: MaternityPrecheckIssue[],
    requiredActions: Set<string>,
    suggestedOrders: Set<string>,
    trace: MaternityPrecheckTrace[],
    doctorEscalationRequired: boolean,
  ): MaternityPrecheckResponse {
    return {
      blockers,
      warnings,
      required_actions: Array.from(requiredActions),
      suggested_orders: Array.from(suggestedOrders),
      doctor_escalation_required: doctorEscalationRequired,
      trace,
    };
  }

  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomed_code ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for maternity payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) ||
      null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  private async normalizeConceptArray(
    tenantDb: DataSource,
    rawList: any,
  ): Promise<StoredConceptSummary[]> {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    const normalized: StoredConceptSummary[] = [];
    for (const entry of rawList) {
      const concept = await this.resolveConcept(tenantDb, entry);
      if (concept) {
        const exists = normalized.find((item) => item.conceptId === concept.conceptId);
        if (!exists) {
          normalized.push(concept);
        }
      }
    }
    return normalized;
  }

  // ===== ENROLLMENTS =====

  async createEnrollment(tenantDb: DataSource, enrollmentData: any, userId?: string) {
    const {
      patient_id,
      enrollment_date,
      lmp_date,
      gravida,
      para,
      parity_term,
      parity_preterm,
      parity_abortions,
      parity_living,
      previous_cesarean,
      previous_complications,
      current_pregnancy_complications,
      previous_complications_snomed,
      current_complications_snomed,
    } = enrollmentData;

    // Calculate EDD from LMP (LMP + 280 days)
    let edd = null;
    let gestationalAgeAtEnrollment = null;

    if (lmp_date) {
      const lmp = new Date(lmp_date);
      edd = new Date(lmp);
      edd.setDate(edd.getDate() + 280); // Add 280 days (40 weeks)

      // Calculate gestational age at enrollment
      const enrollmentDateObj = new Date(enrollment_date);
      const diffTime = Math.abs(enrollmentDateObj.getTime() - lmp.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      gestationalAgeAtEnrollment = Math.floor(diffDays / 7); // Convert to weeks
    }

    // Determine risk category based on history
    let riskCategory = 'low';
    if (previous_cesarean || (para && para >= 5) || (parity_abortions && parity_abortions >= 3)) {
      riskCategory = 'high';
    } else if ((gravida && gravida >= 4) || (parity_preterm && parity_preterm >= 2)) {
      riskCategory = 'medium';
    }

    // Generate enrollment number
    const enrollmentNumber = `MAT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    const previousComplicationsList = await this.normalizeConceptArray(
      tenantDb,
      previous_complications_snomed,
    );
    const currentComplicationsList = await this.normalizeConceptArray(
      tenantDb,
      current_complications_snomed,
    );

    const result = await tenantDb.query(
      `
      INSERT INTO maternity_enrollments (
        patient_id,
        enrollment_number,
        enrollment_date,
        expected_delivery_date,
        edd_method,
        lmp_date,
        gestational_age_at_enrollment,
        gravida,
        para,
        parity_term,
        parity_preterm,
        parity_abortions,
        parity_living,
        previous_cesarean,
        previous_complications,
        previous_complications_snomed,
        current_pregnancy_complications,
        current_complications_snomed,
        risk_category,
        enrollment_status,
        enrolled_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'LMP',
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::jsonb,
        $16,
        $17::jsonb,
        $18,
        'active',
        $19
      )
      RETURNING *
      `,
      [
        patient_id,
        enrollmentNumber,
        enrollment_date,
        edd,
        lmp_date,
        gestationalAgeAtEnrollment,
        gravida,
        para,
        parity_term,
        parity_preterm,
        parity_abortions,
        parity_living,
        previous_cesarean || false,
        previous_complications || null,
        JSON.stringify(previousComplicationsList ?? []),
        current_pregnancy_complications || null,
        JSON.stringify(currentComplicationsList ?? []),
        riskCategory,
        userId ?? null,
      ],
    );

    this.logger.log(`Created maternity enrollment ${enrollmentNumber} for patient ${patient_id}`);
    return result[0];
  }

  async getEnrollments(tenantDb: DataSource, filters: { status?: string; riskCategory?: string } = {}) {
    const query = `
      SELECT 
        me.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.date_of_birth,
        p.phone,
        CASE
          WHEN me.expected_delivery_date IS NOT NULL
            THEN (me.expected_delivery_date::date - CURRENT_DATE::date)
          ELSE NULL
        END as days_to_edd,
        COUNT(DISTINCT av.id) as anc_visit_count,
        COUNT(DISTINCT us.id) as ultrasound_count,
        MAX(av.visit_date) as last_anc_visit_date
      FROM maternity_enrollments me
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN anc_visits av ON av.maternity_enrollment_id = me.id
      LEFT JOIN ultrasound_scans us ON us.maternity_enrollment_id = me.id
      WHERE 1=1
        ${filters.status ? `AND me.enrollment_status = $1` : ''}
        ${filters.riskCategory ? `AND me.risk_category = $${filters.status ? 2 : 1}` : ''}
      GROUP BY me.id, p.id
      ORDER BY me.expected_delivery_date NULLS LAST, me.enrollment_date DESC
    `;

    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.riskCategory) params.push(filters.riskCategory);

    const enrollments = await tenantDb.query(query, params);
    return { enrollments, total: enrollments.length };
  }

  async getEnrollmentById(tenantDb: DataSource, enrollmentId: string) {
    const enrollment = await tenantDb.query(
      `
      SELECT 
        me.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        p.blood_type,
        enrolled_u.first_name || ' ' || enrolled_u.last_name as enrolled_by_name
      FROM maternity_enrollments me
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN users enrolled_u ON enrolled_u.id = me.enrolled_by
      WHERE me.id = $1
      `,
      [enrollmentId],
    );

    if (enrollment.length === 0) {
      throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
    }

    // Get ANC visits
    const ancVisits = await this.getEnrollmentANCVisits(tenantDb, enrollmentId);

    // Get ultrasound scans
    const ultrasounds = await this.getEnrollmentUltrasoundScans(tenantDb, enrollmentId);

    // Get delivery if exists
    const delivery = await this.getEnrollmentDelivery(tenantDb, enrollmentId);

    // Get postnatal visits
    const postnatalVisits = await this.getEnrollmentPostnatalVisits(tenantDb, enrollmentId);

    // Get risk factors
    const riskFactors = await this.getEnrollmentRiskFactors(tenantDb, enrollmentId);

    // Get maternity care tasks
    const careTasks = await this.getEnrollmentMaternityCareTasks(tenantDb, enrollmentId);

    return {
      ...enrollment[0],
      anc_visits: ancVisits.visits || [],
      ultrasound_scans: ultrasounds.scans || [],
      delivery: delivery || null,
      postnatal_visits: postnatalVisits.visits || [],
      risk_factors: riskFactors.riskFactors || [],
      care_tasks: careTasks.tasks || [],
    };
  }

  async getPatientMaternityHistory(tenantDb: DataSource, patientId: string) {
    const enrollments = await tenantDb.query(
      `
      SELECT 
        me.*,
        COUNT(DISTINCT av.id) as anc_visit_count,
        d.delivery_date,
        d.delivery_type
      FROM maternity_enrollments me
      LEFT JOIN anc_visits av ON av.maternity_enrollment_id = me.id
      LEFT JOIN deliveries d ON d.maternity_enrollment_id = me.id
      WHERE me.patient_id = $1
      GROUP BY me.id, d.id
      ORDER BY me.enrollment_date DESC
      `,
      [patientId],
    );

    return { enrollments, total: enrollments.length };
  }

  async updateEnrollment(tenantDb: DataSource, enrollmentId: string, enrollmentData: any) {
    const {
      expected_delivery_date,
      edd_method,
      current_pregnancy_complications,
      risk_category,
      enrollment_status,
      previous_complications,
      previous_complications_snomed,
      current_complications_snomed,
    } = enrollmentData;

    const previousComplicationsSnomedJson =
      previous_complications_snomed === undefined
        ? null
        : JSON.stringify(
            await this.normalizeConceptArray(tenantDb, previous_complications_snomed),
          );
    const currentComplicationsSnomedJson =
      current_complications_snomed === undefined
        ? null
        : JSON.stringify(await this.normalizeConceptArray(tenantDb, current_complications_snomed));

    const result = await tenantDb.query(
      `
      UPDATE maternity_enrollments
      SET 
        expected_delivery_date = COALESCE($1, expected_delivery_date),
        edd_method = COALESCE($2, edd_method),
        current_pregnancy_complications = COALESCE($3, current_pregnancy_complications),
        risk_category = COALESCE($4, risk_category),
        enrollment_status = COALESCE($5, enrollment_status),
        previous_complications = COALESCE($6, previous_complications),
        previous_complications_snomed = COALESCE($7::jsonb, previous_complications_snomed),
        current_complications_snomed = COALESCE($8::jsonb, current_complications_snomed),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
      `,
      [
        expected_delivery_date ?? null,
        edd_method ?? null,
        current_pregnancy_complications ?? null,
        risk_category ?? null,
        enrollment_status ?? null,
        previous_complications ?? null,
        previousComplicationsSnomedJson,
        currentComplicationsSnomedJson,
        enrollmentId,
      ],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
    }

    this.logger.log(`Updated maternity enrollment ${enrollmentId}`);
    return result[0];
  }

  async precheckANCVisit(tenantDb: DataSource, visitData: any): Promise<MaternityPrecheckResponse> {
    const blockers: MaternityPrecheckIssue[] = [];
    const warnings: MaternityPrecheckIssue[] = [];
    const requiredActions = new Set<string>();
    const suggestedOrders = new Set<string>();
    const trace: MaternityPrecheckTrace[] = [];
    let doctorEscalationRequired = false;

    const addIssue = (
      severity: 'blocker' | 'warning',
      code: string,
      message: string,
      field?: string,
      guidelineReference?: string,
    ) => {
      const issue: MaternityPrecheckIssue = {
        code,
        field,
        message,
        guideline_reference: guidelineReference,
      };
      if (severity === 'blocker') {
        blockers.push(issue);
      } else {
        warnings.push(issue);
      }
      trace.push({
        rule_id: code,
        severity,
        message,
      });
    };

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const enrollmentId = visitData?.maternity_enrollment_id;
    const patientId = visitData?.patient_id;
    const visitDate = this.normalizeToDateOnly(visitData?.visit_date);
    const nextVisitDate = this.normalizeToDateOnly(visitData?.next_visit_date);
    const visitNumber = toNumber(visitData?.visit_number);

    if (!enrollmentId) {
      addIssue('blocker', 'anc.missing_enrollment_id', 'Maternity enrollment is required.', 'maternity_enrollment_id');
    }
    if (!patientId) {
      addIssue('blocker', 'anc.missing_patient_id', 'Patient is required.', 'patient_id');
    }
    if (!visitDate) {
      addIssue('blocker', 'anc.invalid_visit_date', 'Valid ANC visit date is required.', 'visit_date');
    }

    let enrollment: any | null = null;
    let existingDelivery: any | null = null;

    if (enrollmentId) {
      const enrollmentRows = await tenantDb.query(
        `SELECT id, patient_id, enrollment_date, lmp_date FROM maternity_enrollments WHERE id = $1`,
        [enrollmentId],
      );
      if (enrollmentRows.length === 0) {
        addIssue('blocker', 'anc.enrollment_not_found', 'Maternity enrollment was not found.', 'maternity_enrollment_id');
      } else {
        enrollment = enrollmentRows[0];
      }

      const deliveryRows = await tenantDb.query(
        `SELECT id, delivery_date FROM deliveries WHERE maternity_enrollment_id = $1 ORDER BY delivery_date DESC LIMIT 1`,
        [enrollmentId],
      );
      if (deliveryRows.length > 0) {
        existingDelivery = deliveryRows[0];
      }
    }

    if (enrollment && patientId && enrollment.patient_id !== patientId) {
      addIssue(
        'blocker',
        'anc.patient_enrollment_mismatch',
        'Patient does not match the selected maternity enrollment.',
        'patient_id',
      );
    }

    if (visitDate && enrollment?.enrollment_date) {
      const enrollmentDate = this.normalizeToDateOnly(enrollment.enrollment_date);
      if (enrollmentDate && visitDate < enrollmentDate) {
        addIssue(
          'blocker',
          'anc.visit_before_enrollment',
          'ANC visit date cannot be before enrollment date.',
          'visit_date',
        );
      }
    }

    if (visitDate && enrollment?.lmp_date) {
      const lmpDate = this.normalizeToDateOnly(enrollment.lmp_date);
      if (lmpDate && visitDate < lmpDate) {
        addIssue(
          'blocker',
          'anc.visit_before_lmp',
          'ANC visit date cannot be before LMP date.',
          'visit_date',
        );
      }
    }

    if (visitDate && existingDelivery?.delivery_date) {
      const deliveryDate = this.normalizeToDateOnly(existingDelivery.delivery_date);
      if (deliveryDate && visitDate > deliveryDate) {
        addIssue(
          'blocker',
          'anc.visit_after_delivery',
          'ANC visit date cannot be after delivery date. Use postnatal visit workflow.',
          'visit_date',
        );
      }
    }

    if (visitDate && nextVisitDate && nextVisitDate < visitDate) {
      addIssue(
        'blocker',
        'anc.next_visit_before_visit',
        'Next ANC visit date cannot be earlier than current visit date.',
        'next_visit_date',
      );
    }

    const ancVitalsSourceId = this.normalizeString(visitData?.vitals_source_vital_id);
    const ancVitalsOverrideReason = this.normalizeString(visitData?.vitals_override_reason);
    const ancVitalsOverridden =
      this.normalizeBoolean(visitData?.vitals_overridden) || Boolean(ancVitalsOverrideReason);

    if (ancVitalsOverridden && !ancVitalsOverrideReason) {
      addIssue(
        'blocker',
        'anc.vitals_override_reason_required',
        'Provide a reason when overriding auto-populated vitals.',
        'vitals_override_reason',
      );
    }

    if (ancVitalsOverridden && !ancVitalsSourceId) {
      addIssue(
        'blocker',
        'anc.vitals_source_required_for_override',
        'A source vital record is required when overriding auto-populated vitals.',
        'vitals_source_vital_id',
      );
    }

    if (ancVitalsSourceId) {
      const sourceRows = await tenantDb.query(
        `SELECT id, patient_id, recorded_at, created_at FROM vitals WHERE id = $1 LIMIT 1`,
        [ancVitalsSourceId],
      );
      if (sourceRows.length === 0) {
        addIssue(
          'blocker',
          'anc.vitals_source_not_found',
          'Selected source vital record was not found.',
          'vitals_source_vital_id',
        );
      } else {
        const sourceVital = sourceRows[0];
        if (patientId && sourceVital.patient_id !== patientId) {
          addIssue(
            'blocker',
            'anc.vitals_source_patient_mismatch',
            'Selected source vital record belongs to a different patient.',
            'vitals_source_vital_id',
          );
        }
        if (visitDate) {
          const sourceDate = this.normalizeToDateOnly(
            sourceVital.recorded_at || sourceVital.created_at,
          );
          if (sourceDate && sourceDate.getTime() !== visitDate.getTime()) {
            addIssue(
              'blocker',
              'anc.vitals_source_date_mismatch',
              'Selected source vital record is not from the same visit date.',
              'vitals_source_vital_id',
            );
          }
        }
      }
    }

    if (enrollmentId && visitNumber !== null) {
      const duplicateRows = await tenantDb.query(
        `SELECT id FROM anc_visits WHERE maternity_enrollment_id = $1 AND visit_number = $2 LIMIT 1`,
        [enrollmentId, visitNumber],
      );
      if (duplicateRows.length > 0) {
        addIssue(
          'blocker',
          'anc.duplicate_visit_number',
          'ANC visit number already exists for this enrollment.',
          'visit_number',
        );
      }
    }

    if (visitData?.referral_needed) {
      if (!visitData?.referral_reason || String(visitData.referral_reason).trim() === '') {
        addIssue(
          'blocker',
          'anc.referral_reason_required',
          'Referral reason is required when referral is marked as needed.',
          'referral_reason',
        );
      }
      if (!visitData?.referral_facility || String(visitData.referral_facility).trim() === '') {
        addIssue(
          'blocker',
          'anc.referral_facility_required',
          'Referral facility is required when referral is marked as needed.',
          'referral_facility',
        );
      }
    }

    const systolic = toNumber(visitData?.blood_pressure_systolic);
    const diastolic = toNumber(visitData?.blood_pressure_diastolic);
    const temperature = toNumber(visitData?.temperature);
    const fetalMovement = String(visitData?.fetal_movement || '').trim().toLowerCase();

    if ((systolic !== null && systolic >= 160) || (diastolic !== null && diastolic >= 110)) {
      doctorEscalationRequired = true;
      requiredActions.add('Immediate urgent obstetric review is required.');
      suggestedOrders.add('Urgent urine protein and pre-eclampsia workup');
      addIssue(
        'blocker',
        'anc.severe_hypertension',
        'Severe hypertension detected. Immediate escalation is required before finalizing visit.',
        'blood_pressure_systolic',
        'WHO ANC hypertension danger-sign guidance',
      );
    } else if ((systolic !== null && systolic >= 140) || (diastolic !== null && diastolic >= 90)) {
      doctorEscalationRequired = true;
      suggestedOrders.add('Urinalysis/proteinuria and repeat blood pressure');
      addIssue(
        'warning',
        'anc.hypertension_warning',
        'Raised blood pressure detected; evaluate for hypertensive disorder of pregnancy.',
        'blood_pressure_systolic',
        'WHO ANC hypertensive disorders screening guidance',
      );
    }

    if (temperature !== null && temperature >= 38) {
      doctorEscalationRequired = true;
      requiredActions.add('Assess for maternal infection and sepsis risk.');
      addIssue(
        'warning',
        'anc.fever_warning',
        'Maternal fever detected; evaluate for infection and danger signs.',
        'temperature',
        'WHO ANC danger-sign guidance',
      );
    }

    if (fetalMovement === 'absent' || fetalMovement === 'reduced') {
      doctorEscalationRequired = true;
      requiredActions.add('Assess fetal wellbeing urgently (FHR/ultrasound).');
      addIssue(
        'warning',
        'anc.fetal_movement_concern',
        'Reduced or absent fetal movement documented; urgent fetal assessment recommended.',
        'fetal_movement',
        'WHO ANC fetal surveillance recommendations',
      );
    }

    return this.createPrecheckResponse(
      blockers,
      warnings,
      requiredActions,
      suggestedOrders,
      trace,
      doctorEscalationRequired,
    );
  }

  async precheckDelivery(tenantDb: DataSource, deliveryData: any): Promise<MaternityPrecheckResponse> {
    const blockers: MaternityPrecheckIssue[] = [];
    const warnings: MaternityPrecheckIssue[] = [];
    const requiredActions = new Set<string>();
    const suggestedOrders = new Set<string>();
    const trace: MaternityPrecheckTrace[] = [];
    let doctorEscalationRequired = false;

    const addIssue = (
      severity: 'blocker' | 'warning',
      code: string,
      message: string,
      field?: string,
      guidelineReference?: string,
    ) => {
      const issue: MaternityPrecheckIssue = {
        code,
        field,
        message,
        guideline_reference: guidelineReference,
      };
      if (severity === 'blocker') {
        blockers.push(issue);
      } else {
        warnings.push(issue);
      }
      trace.push({ rule_id: code, severity, message });
    };

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const enrollmentId = deliveryData?.maternity_enrollment_id;
    const patientId = deliveryData?.patient_id;
    const deliveryDate = this.normalizeToDateOnly(deliveryData?.delivery_date);
    const deliveryTime = String(deliveryData?.delivery_time || '').trim();
    const deliveryType = String(deliveryData?.delivery_type || '').trim();

    if (!enrollmentId) {
      addIssue('blocker', 'delivery.missing_enrollment_id', 'Maternity enrollment is required.', 'maternity_enrollment_id');
    }
    if (!patientId) {
      addIssue('blocker', 'delivery.missing_patient_id', 'Patient is required.', 'patient_id');
    }
    if (!deliveryDate) {
      addIssue('blocker', 'delivery.invalid_delivery_date', 'Valid delivery date is required.', 'delivery_date');
    }
    if (!deliveryTime) {
      addIssue('blocker', 'delivery.missing_delivery_time', 'Delivery time is required.', 'delivery_time');
    }
    if (!deliveryType) {
      addIssue('blocker', 'delivery.missing_delivery_type', 'Delivery type is required.', 'delivery_type');
    }

    let enrollment: any | null = null;
    if (enrollmentId) {
      const enrollmentRows = await tenantDb.query(
        `SELECT id, patient_id, enrollment_date, lmp_date FROM maternity_enrollments WHERE id = $1`,
        [enrollmentId],
      );
      if (enrollmentRows.length === 0) {
        addIssue('blocker', 'delivery.enrollment_not_found', 'Maternity enrollment was not found.', 'maternity_enrollment_id');
      } else {
        enrollment = enrollmentRows[0];
      }

      const existingDeliveryRows = await tenantDb.query(
        `SELECT id FROM deliveries WHERE maternity_enrollment_id = $1 LIMIT 1`,
        [enrollmentId],
      );
      if (existingDeliveryRows.length > 0) {
        addIssue(
          'blocker',
          'delivery.duplicate_delivery_record',
          'A delivery record already exists for this enrollment.',
          'maternity_enrollment_id',
        );
      }
    }

    if (enrollment && patientId && enrollment.patient_id !== patientId) {
      addIssue(
        'blocker',
        'delivery.patient_enrollment_mismatch',
        'Patient does not match the selected maternity enrollment.',
        'patient_id',
      );
    }

    if (deliveryDate && enrollment?.enrollment_date) {
      const enrollmentDate = this.normalizeToDateOnly(enrollment.enrollment_date);
      if (enrollmentDate && deliveryDate < enrollmentDate) {
        addIssue(
          'blocker',
          'delivery.before_enrollment',
          'Delivery date cannot be before enrollment date.',
          'delivery_date',
        );
      }
    }

    if (
      deliveryType === 'cesarean' &&
      (!deliveryData?.indication_for_intervention ||
        String(deliveryData.indication_for_intervention).trim() === '')
    ) {
      addIssue(
        'blocker',
        'delivery.cesarean_indication_required',
        'Indication for intervention is required for cesarean delivery.',
        'indication_for_intervention',
      );
    }

    const bloodLoss = toNumber(deliveryData?.blood_loss);
    if (bloodLoss !== null && bloodLoss >= 1000) {
      doctorEscalationRequired = true;
      requiredActions.add('Initiate/confirm postpartum hemorrhage management protocol.');
      addIssue(
        'warning',
        'delivery.pph_risk',
        'Severe blood loss documented (>=1000 mL); urgent senior review is recommended.',
        'blood_loss',
        'WHO postpartum hemorrhage management guidance',
      );
    }

    const maternalOutcome = String(deliveryData?.maternal_outcome || '').trim().toLowerCase();
    if (maternalOutcome && maternalOutcome !== 'alive_well') {
      doctorEscalationRequired = true;
      requiredActions.add('Document maternal complication pathway and definitive management.');
      addIssue(
        'warning',
        'delivery.adverse_maternal_outcome',
        'Non-routine maternal outcome captured; escalation and documented follow-up required.',
        'maternal_outcome',
      );
    }

    if (deliveryDate && enrollment?.lmp_date) {
      const lmpDate = this.normalizeToDateOnly(enrollment.lmp_date);
      if (lmpDate) {
        const gestationDays = Math.floor(
          (deliveryDate.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const gestationWeeks = Math.floor(gestationDays / 7);
        if (gestationWeeks > 0 && gestationWeeks < 20) {
          addIssue(
            'warning',
            'delivery.gestation_early_warning',
            `Computed gestation at delivery is approximately ${gestationWeeks} weeks; verify dates for consistency.`,
            'delivery_date',
          );
        }
      }
    }

    return this.createPrecheckResponse(
      blockers,
      warnings,
      requiredActions,
      suggestedOrders,
      trace,
      doctorEscalationRequired,
    );
  }

  async precheckBirthOutcome(tenantDb: DataSource, birthData: any): Promise<MaternityPrecheckResponse> {
    const blockers: MaternityPrecheckIssue[] = [];
    const warnings: MaternityPrecheckIssue[] = [];
    const requiredActions = new Set<string>();
    const suggestedOrders = new Set<string>();
    const trace: MaternityPrecheckTrace[] = [];
    let doctorEscalationRequired = false;

    const addIssue = (
      severity: 'blocker' | 'warning',
      code: string,
      message: string,
      field?: string,
      guidelineReference?: string,
    ) => {
      const issue: MaternityPrecheckIssue = {
        code,
        field,
        message,
        guideline_reference: guidelineReference,
      };
      if (severity === 'blocker') {
        blockers.push(issue);
      } else {
        warnings.push(issue);
      }
      trace.push({ rule_id: code, severity, message });
    };

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const deliveryId = birthData?.delivery_id;
    const birthOrder = toNumber(birthData?.birth_order) || 1;
    const birthOutcome = String(birthData?.birth_outcome || '').trim();
    const sex = String(birthData?.sex || '').trim();

    if (!deliveryId) {
      addIssue('blocker', 'birth.missing_delivery_id', 'Delivery record is required before birth outcome capture.', 'delivery_id');
    }
    if (!birthOutcome) {
      addIssue('blocker', 'birth.missing_outcome', 'Birth outcome is required.', 'birth_outcome');
    }
    if (!sex) {
      addIssue('blocker', 'birth.missing_sex', 'Newborn sex is required.', 'sex');
    }

    if (deliveryId) {
      const deliveryRows = await tenantDb.query(`SELECT id FROM deliveries WHERE id = $1`, [deliveryId]);
      if (deliveryRows.length === 0) {
        addIssue('blocker', 'birth.delivery_not_found', 'Delivery record was not found.', 'delivery_id');
      }

      const duplicateOrderRows = await tenantDb.query(
        `SELECT id FROM birth_outcomes WHERE delivery_id = $1 AND birth_order = $2 LIMIT 1`,
        [deliveryId, birthOrder],
      );
      if (duplicateOrderRows.length > 0) {
        addIssue(
          'blocker',
          'birth.duplicate_birth_order',
          'Birth order already exists for this delivery.',
          'birth_order',
        );
      }
    }

    if (birthData?.resuscitation_required && !String(birthData?.resuscitation_type || '').trim()) {
      addIssue(
        'blocker',
        'birth.resuscitation_type_required',
        'Resuscitation type is required when resuscitation is marked as required.',
        'resuscitation_type',
      );
    }

    const birthWeight = toNumber(birthData?.birth_weight);
    if (birthWeight !== null && birthWeight < 2.5) {
      doctorEscalationRequired = true;
      suggestedOrders.add('Neonatal low-birth-weight monitoring bundle');
      addIssue(
        'warning',
        'birth.low_birth_weight',
        'Low birth weight detected (<2.5 kg); enhanced neonatal monitoring recommended.',
        'birth_weight',
        'WHO low birth weight newborn care guidance',
      );
    }

    const apgar5 = toNumber(birthData?.apgar_5min);
    if (apgar5 !== null && apgar5 < 7) {
      doctorEscalationRequired = true;
      requiredActions.add('Escalate to neonatal resuscitation/review pathway.');
      addIssue(
        'warning',
        'birth.low_apgar_5min',
        'Low APGAR at 5 minutes detected (<7).',
        'apgar_5min',
      );
    }

    const newbornOutcome = String(birthData?.newborn_outcome || '').trim().toLowerCase();
    const timeOfDeath = birthData?.time_of_death;
    if (newbornOutcome === 'neonatal_death' && !timeOfDeath) {
      addIssue(
        'blocker',
        'birth.time_of_death_required',
        'Time of death is required when newborn outcome is neonatal death.',
        'time_of_death',
      );
    }

    const normalizedOutcome = birthOutcome.toLowerCase();
    if (
      (normalizedOutcome === 'stillbirth' || normalizedOutcome === 'neonatal_death') &&
      !String(birthData?.cause_of_death || '').trim()
    ) {
      requiredActions.add('Document cause of death before case closure.');
      addIssue(
        'warning',
        'birth.cause_of_death_missing',
        'Cause of death should be documented for stillbirth/neonatal death.',
        'cause_of_death',
      );
    }

    return this.createPrecheckResponse(
      blockers,
      warnings,
      requiredActions,
      suggestedOrders,
      trace,
      doctorEscalationRequired,
    );
  }

  async precheckPostnatalVisit(tenantDb: DataSource, visitData: any): Promise<MaternityPrecheckResponse> {
    const blockers: MaternityPrecheckIssue[] = [];
    const warnings: MaternityPrecheckIssue[] = [];
    const requiredActions = new Set<string>();
    const suggestedOrders = new Set<string>();
    const trace: MaternityPrecheckTrace[] = [];
    let doctorEscalationRequired = false;

    const addIssue = (
      severity: 'blocker' | 'warning',
      code: string,
      message: string,
      field?: string,
      guidelineReference?: string,
    ) => {
      const issue: MaternityPrecheckIssue = {
        code,
        field,
        message,
        guideline_reference: guidelineReference,
      };
      if (severity === 'blocker') {
        blockers.push(issue);
      } else {
        warnings.push(issue);
      }
      trace.push({ rule_id: code, severity, message });
    };

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const enrollmentId = visitData?.maternity_enrollment_id;
    const patientId = visitData?.patient_id;
    const deliveryId = visitData?.delivery_id;
    const visitDate = this.normalizeToDateOnly(visitData?.visit_date);
    const nextVisitDate = this.normalizeToDateOnly(visitData?.next_visit_date);

    if (!enrollmentId) {
      addIssue('blocker', 'postnatal.missing_enrollment_id', 'Maternity enrollment is required.', 'maternity_enrollment_id');
    }
    if (!patientId) {
      addIssue('blocker', 'postnatal.missing_patient_id', 'Patient is required.', 'patient_id');
    }
    if (!deliveryId) {
      addIssue('blocker', 'postnatal.missing_delivery_id', 'Delivery record is required for postnatal visit.', 'delivery_id');
    }
    if (!visitDate) {
      addIssue('blocker', 'postnatal.invalid_visit_date', 'Valid postnatal visit date is required.', 'visit_date');
    }

    let enrollment: any | null = null;
    let delivery: any | null = null;

    if (enrollmentId) {
      const enrollmentRows = await tenantDb.query(
        `SELECT id, patient_id FROM maternity_enrollments WHERE id = $1`,
        [enrollmentId],
      );
      if (enrollmentRows.length === 0) {
        addIssue('blocker', 'postnatal.enrollment_not_found', 'Maternity enrollment was not found.', 'maternity_enrollment_id');
      } else {
        enrollment = enrollmentRows[0];
      }
    }

    if (deliveryId) {
      const deliveryRows = await tenantDb.query(
        `SELECT id, patient_id, delivery_date, maternity_enrollment_id FROM deliveries WHERE id = $1`,
        [deliveryId],
      );
      if (deliveryRows.length === 0) {
        addIssue('blocker', 'postnatal.delivery_not_found', 'Delivery record was not found.', 'delivery_id');
      } else {
        delivery = deliveryRows[0];
      }
    }

    if (enrollment && patientId && enrollment.patient_id !== patientId) {
      addIssue(
        'blocker',
        'postnatal.patient_enrollment_mismatch',
        'Patient does not match the selected maternity enrollment.',
        'patient_id',
      );
    }

    if (delivery && patientId && delivery.patient_id !== patientId) {
      addIssue(
        'blocker',
        'postnatal.patient_delivery_mismatch',
        'Patient does not match the selected delivery record.',
        'patient_id',
      );
    }

    if (delivery && enrollmentId && delivery.maternity_enrollment_id !== enrollmentId) {
      addIssue(
        'blocker',
        'postnatal.delivery_enrollment_mismatch',
        'Delivery record does not belong to the selected maternity enrollment.',
        'delivery_id',
      );
    }

    if (visitDate && delivery?.delivery_date) {
      const deliveryDate = this.normalizeToDateOnly(delivery.delivery_date);
      if (deliveryDate && visitDate < deliveryDate) {
        addIssue(
          'blocker',
          'postnatal.before_delivery',
          'Postnatal visit date cannot be before delivery date.',
          'visit_date',
        );
      }

      if (deliveryDate) {
        const daysPostpartum = Math.floor(
          (visitDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysPostpartum > 42) {
          addIssue(
            'warning',
            'postnatal.outside_42_day_window',
            'Visit is beyond 42 postpartum days; confirm if this should be a routine postpartum follow-up.',
            'visit_date',
          );
        }
      }
    }

    if (visitDate && nextVisitDate && nextVisitDate < visitDate) {
      addIssue(
        'blocker',
        'postnatal.next_visit_before_visit',
        'Next visit date cannot be earlier than current postnatal visit date.',
        'next_visit_date',
      );
    }

    const postnatalVitalsSourceId = this.normalizeString(visitData?.vitals_source_vital_id);
    const postnatalVitalsOverrideReason = this.normalizeString(visitData?.vitals_override_reason);
    const postnatalVitalsOverridden =
      this.normalizeBoolean(visitData?.vitals_overridden) || Boolean(postnatalVitalsOverrideReason);

    if (postnatalVitalsOverridden && !postnatalVitalsOverrideReason) {
      addIssue(
        'blocker',
        'postnatal.vitals_override_reason_required',
        'Provide a reason when overriding auto-populated vitals.',
        'vitals_override_reason',
      );
    }

    if (postnatalVitalsOverridden && !postnatalVitalsSourceId) {
      addIssue(
        'blocker',
        'postnatal.vitals_source_required_for_override',
        'A source vital record is required when overriding auto-populated vitals.',
        'vitals_source_vital_id',
      );
    }

    if (postnatalVitalsSourceId) {
      const sourceRows = await tenantDb.query(
        `SELECT id, patient_id, recorded_at, created_at FROM vitals WHERE id = $1 LIMIT 1`,
        [postnatalVitalsSourceId],
      );
      if (sourceRows.length === 0) {
        addIssue(
          'blocker',
          'postnatal.vitals_source_not_found',
          'Selected source vital record was not found.',
          'vitals_source_vital_id',
        );
      } else {
        const sourceVital = sourceRows[0];
        if (patientId && sourceVital.patient_id !== patientId) {
          addIssue(
            'blocker',
            'postnatal.vitals_source_patient_mismatch',
            'Selected source vital record belongs to a different patient.',
            'vitals_source_vital_id',
          );
        }
        if (visitDate) {
          const sourceDate = this.normalizeToDateOnly(
            sourceVital.recorded_at || sourceVital.created_at,
          );
          if (sourceDate && sourceDate.getTime() !== visitDate.getTime()) {
            addIssue(
              'blocker',
              'postnatal.vitals_source_date_mismatch',
              'Selected source vital record is not from the same visit date.',
              'vitals_source_vital_id',
            );
          }
        }
      }
    }

    const systolic = toNumber(visitData?.blood_pressure_systolic);
    const diastolic = toNumber(visitData?.blood_pressure_diastolic);
    const temperature = toNumber(visitData?.temperature);
    const dangerSigns = String(visitData?.danger_signs || '').trim();

    if ((systolic !== null && systolic >= 160) || (diastolic !== null && diastolic >= 110)) {
      doctorEscalationRequired = true;
      requiredActions.add('Immediate postpartum hypertension/eclampsia review is required.');
      addIssue(
        'blocker',
        'postnatal.severe_hypertension',
        'Severe postpartum hypertension detected.',
        'blood_pressure_systolic',
        'WHO postnatal maternal danger-sign guidance',
      );
    } else if ((systolic !== null && systolic >= 140) || (diastolic !== null && diastolic >= 90)) {
      doctorEscalationRequired = true;
      addIssue(
        'warning',
        'postnatal.hypertension_warning',
        'Raised postpartum blood pressure detected; review for hypertensive disorders.',
        'blood_pressure_systolic',
      );
    }

    if (temperature !== null && temperature >= 38) {
      doctorEscalationRequired = true;
      requiredActions.add('Assess postpartum infection/sepsis risk.');
      addIssue(
        'warning',
        'postnatal.fever_warning',
        'Postpartum fever detected; evaluate for infection.',
        'temperature',
      );
    }

    if (dangerSigns) {
      doctorEscalationRequired = true;
      requiredActions.add('Document and close maternal danger-sign response plan.');
      addIssue(
        'warning',
        'postnatal.danger_signs_recorded',
        'Postnatal danger signs were documented and require escalation follow-through.',
        'danger_signs',
        'WHO postnatal care danger-sign recommendations',
      );
    }

    if (
      Boolean(visitData?.family_planning_discussed) &&
      (!visitData?.family_planning_method || String(visitData.family_planning_method).trim() === '')
    ) {
      addIssue(
        'warning',
        'postnatal.fp_method_missing',
        'Family planning was discussed but no method was captured.',
        'family_planning_method',
      );
    }

    return this.createPrecheckResponse(
      blockers,
      warnings,
      requiredActions,
      suggestedOrders,
      trace,
      doctorEscalationRequired,
    );
  }

  // ===== ANC VISITS =====

  async createANCVisit(tenantDb: DataSource, visitData: any, userId?: string) {
    const precheck = await this.precheckANCVisit(tenantDb, visitData);
    this.assertPrecheckAllowsPersistence(
      precheck,
      visitData?.safety_warnings_acknowledged,
      'ANC visit',
    );

    const {
      maternity_enrollment_id,
      patient_id,
      visit_number,
      visit_date,
      complications_snomed,
      interventions_snomed,
      referral_reason_snomed,
      ...vitalFields
    } = visitData;

    // Calculate gestational age from LMP
    const enrollment = await tenantDb.query(
      `SELECT lmp_date FROM maternity_enrollments WHERE id = $1`,
      [maternity_enrollment_id],
    );

    let gestationalAge = null;
    let gestationalAgeDays = null;

    if (enrollment.length > 0 && enrollment[0].lmp_date) {
      const lmp = new Date(enrollment[0].lmp_date);
      const visitDateObj = new Date(visit_date);
      const diffTime = Math.abs(visitDateObj.getTime() - lmp.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      gestationalAge = Math.floor(diffDays / 7);
      gestationalAgeDays = diffDays % 7;
    }

    // Calculate BMI if weight and height provided
    let bmi = null;
    if (vitalFields.weight && vitalFields.height) {
      const heightMeters = vitalFields.height / 100;
      bmi = (vitalFields.weight / (heightMeters * heightMeters)).toFixed(2);
    }

    const complicationsList = await this.normalizeConceptArray(tenantDb, complications_snomed);
    const interventionsList = await this.normalizeConceptArray(tenantDb, interventions_snomed);
    const referralConcept = await this.resolveConcept(tenantDb, referral_reason_snomed);
    const vitalsProvenance = await this.validateVitalsProvenanceForPersistence(tenantDb, {
      patientId: patient_id,
      visitDate: visit_date,
      context: 'anc',
      sourceVitalId: vitalFields.vitals_source_vital_id,
      autoPopulatedAt: vitalFields.vitals_auto_populated_at,
      overridden: vitalFields.vitals_overridden,
      overrideReason: vitalFields.vitals_override_reason,
    });

    const result = await tenantDb.query(
      `
      INSERT INTO anc_visits (
        maternity_enrollment_id, patient_id, visit_number, visit_date,
        gestational_age, gestational_age_days, weight, height, bmi,
        blood_pressure_systolic, blood_pressure_diastolic, temperature,
        pulse, respiratory_rate, fundal_height, fetal_heart_rate,
        fetal_presentation, fetal_movement, edema, edema_location,
        proteinuria, glucose_urine, hemoglobin, blood_group, rhesus,
        vdrl_syphilis, hiv_status, hep_b_status, tetanus_immunization,
        ipt_malaria, iron_folate, deworming, insecticide_treated_net,
        danger_signs_discussed, birth_plan_discussed, complications_identified,
        complications_snomed, interventions, interventions_snomed, referral_needed,
        referral_reason, referral_reason_snomed_code, referral_reason_snomed_term,
        referral_reason_snomed_module_id, referral_reason_snomed_definition_status,
        referral_facility, next_visit_date, provider, notes,
        vitals_source_vital_id, vitals_auto_populated_at, vitals_overridden, vitals_override_reason
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39::jsonb, $40, $41::jsonb,
        $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52
      )
      RETURNING *
      `,
      [
        maternity_enrollment_id,
        patient_id,
        visit_number,
        visit_date,
        gestationalAge,
        gestationalAgeDays,
        vitalFields.weight,
        vitalFields.height,
        bmi,
        vitalFields.blood_pressure_systolic,
        vitalFields.blood_pressure_diastolic,
        vitalFields.temperature,
        vitalFields.pulse,
        vitalFields.respiratory_rate,
        vitalFields.fundal_height,
        vitalFields.fetal_heart_rate,
        vitalFields.fetal_presentation,
        vitalFields.fetal_movement,
        vitalFields.edema,
        vitalFields.edema_location,
        vitalFields.proteinuria,
        vitalFields.glucose_urine,
        vitalFields.hemoglobin,
        vitalFields.blood_group,
        vitalFields.rhesus,
        vitalFields.vdrl_syphilis,
        vitalFields.hiv_status,
        vitalFields.hep_b_status,
        vitalFields.tetanus_immunization,
        vitalFields.ipt_malaria,
        vitalFields.iron_folate,
        vitalFields.deworming,
        vitalFields.insecticide_treated_net,
        vitalFields.danger_signs_discussed,
        vitalFields.birth_plan_discussed,
        vitalFields.complications_identified,
        JSON.stringify(complicationsList ?? []),
        vitalFields.interventions,
        JSON.stringify(interventionsList ?? []),
        vitalFields.referral_needed,
        vitalFields.referral_reason || referralConcept?.term || null,
        referralConcept?.conceptId ?? null,
        referralConcept?.term ?? null,
        referralConcept?.moduleId ?? null,
        referralConcept?.definitionStatus ?? null,
        vitalFields.referral_facility,
        vitalFields.next_visit_date,
        userId,
        vitalFields.notes,
        vitalsProvenance.sourceVitalId,
        vitalsProvenance.autoPopulatedAt,
        vitalsProvenance.overridden,
        vitalsProvenance.overrideReason,
      ],
    );

    const createdVisit = result[0];

    await this.createEscalationTaskFromPrecheck(tenantDb, {
      enrollmentId: maternity_enrollment_id,
      patientId: patient_id,
      sourceType: 'anc_visit',
      sourceRecordId: createdVisit.id,
      createdBy: userId,
      title: 'ANC visit requires doctor review',
      summary: `ANC visit #${visit_number} recorded on ${visit_date} triggered maternity safety escalation.`,
      precheck,
      taskContext: {
        visitNumber: visit_number,
        visitDate: visit_date,
      },
    });

    this.logger.log(`Created ANC visit #${visit_number} for enrollment ${maternity_enrollment_id}`);
    return createdVisit;
  }

  async getEnrollmentANCVisits(tenantDb: DataSource, enrollmentId: string) {
    const visits = await tenantDb.query(
      `
      SELECT 
        av.*,
        u.first_name || ' ' || u.last_name as provider_name
      FROM anc_visits av
      LEFT JOIN users u ON u.id = av.provider
      WHERE av.maternity_enrollment_id = $1
      ORDER BY av.visit_number, av.visit_date
      `,
      [enrollmentId],
    );

    return { visits, total: visits.length };
  }

  async getANCVisitById(tenantDb: DataSource, visitId: string) {
    const visit = await tenantDb.query(
      `
      SELECT 
        av.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        u.first_name || ' ' || u.last_name as provider_name
      FROM anc_visits av
      INNER JOIN patients p ON p.id = av.patient_id
      LEFT JOIN users u ON u.id = av.provider
      WHERE av.id = $1
      `,
      [visitId],
    );

    if (visit.length === 0) {
      throw new NotFoundException(`ANC visit with ID ${visitId} not found`);
    }

    return visit[0];
  }

  async updateANCVisit(tenantDb: DataSource, visitId: string, visitData: any) {
    // Build dynamic UPDATE query based on provided fields
    const fields = Object.keys(visitData).filter((k) => visitData[k] !== undefined);
    
    if (fields.length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    if (visitData.complications_snomed !== undefined) {
      visitData.complications_snomed =
        visitData.complications_snomed === null
          ? null
          : JSON.stringify(
              await this.normalizeConceptArray(tenantDb, visitData.complications_snomed),
            );
    }
    if (visitData.interventions_snomed !== undefined) {
      visitData.interventions_snomed =
        visitData.interventions_snomed === null
          ? null
          : JSON.stringify(
              await this.normalizeConceptArray(tenantDb, visitData.interventions_snomed),
            );
    }
    if (visitData.referral_reason_snomed !== undefined) {
      const resolvedReferral = await this.resolveConcept(tenantDb, visitData.referral_reason_snomed);
      visitData.referral_reason_snomed_code = resolvedReferral?.conceptId ?? null;
      visitData.referral_reason_snomed_term = resolvedReferral?.term ?? null;
      visitData.referral_reason_snomed_module_id = resolvedReferral?.moduleId ?? null;
      visitData.referral_reason_snomed_definition_status = resolvedReferral?.definitionStatus ?? null;
      if (resolvedReferral?.term) {
        visitData.referral_reason = visitData.referral_reason ?? resolvedReferral.term;
      }
      delete visitData.referral_reason_snomed;
      if (
        !fields.includes('referral_reason_snomed_code')
      ) {
        fields.push('referral_reason_snomed_code');
      }
      if (!fields.includes('referral_reason_snomed_term')) {
        fields.push('referral_reason_snomed_term');
      }
      if (!fields.includes('referral_reason_snomed_module_id')) {
        fields.push('referral_reason_snomed_module_id');
      }
      if (!fields.includes('referral_reason_snomed_definition_status')) {
        fields.push('referral_reason_snomed_definition_status');
      }
      if (!fields.includes('referral_reason') && resolvedReferral?.term) {
        fields.push('referral_reason');
      }
    }

    const jsonFields = new Set(['complications_snomed', 'interventions_snomed']);

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}${jsonFields.has(field) ? '::jsonb' : ''}`)
      .join(', ');
    const values = fields.map((field) => visitData[field]);
    values.push(visitId); // For WHERE clause

    const result = await tenantDb.query(
      `
      UPDATE anc_visits
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
      `,
      values,
    );

    if (result.length === 0) {
      throw new NotFoundException(`ANC visit with ID ${visitId} not found`);
    }

    this.logger.log(`Updated ANC visit ${visitId}`);
    return result[0];
  }

  // ===== ULTRASOUND SCANS =====

  async createUltrasoundScan(tenantDb: DataSource, scanData: any, userId?: string) {
    const {
      maternity_enrollment_id,
      patient_id,
      scan_date,
      gestational_age,
      scan_type,
      number_of_fetuses,
      fetal_viability,
      fetal_heartbeat,
      fetal_presentation,
      placenta_position,
      amniotic_fluid,
      afi,
      estimated_fetal_weight,
      biparietal_diameter,
      head_circumference,
      abdominal_circumference,
      femur_length,
      anomalies_detected,
      findings,
      anomalies_snomed,
      findings_snomed,
      image_path,
    } = scanData;

    // Calculate EDD from biometry if dating scan
    let eddByUltrasound = null;
    if (scan_type === 'dating' && biparietal_diameter) {
      // Simplified EDD calculation - in reality would use growth charts
      const estimatedGA = Math.round(biparietal_diameter / 2.5); // Rough approximation
      const scanDateObj = new Date(scan_date);
      eddByUltrasound = new Date(scanDateObj);
      eddByUltrasound.setDate(eddByUltrasound.getDate() + (280 - estimatedGA * 7));
    }

    const anomaliesList = await this.normalizeConceptArray(tenantDb, anomalies_snomed);
    const findingsList = await this.normalizeConceptArray(tenantDb, findings_snomed);

    const result = await tenantDb.query(
      `
      INSERT INTO ultrasound_scans (
        maternity_enrollment_id, patient_id, scan_date, gestational_age,
        scan_type, number_of_fetuses, fetal_viability, fetal_heartbeat,
        fetal_presentation, placenta_position, amniotic_fluid, afi,
        estimated_fetal_weight, biparietal_diameter, head_circumference,
        abdominal_circumference, femur_length, anomalies_detected,
        anomalies_snomed, edd_by_ultrasound, findings, findings_snomed,
        performed_by, image_path
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19::jsonb, $20, $21, $22::jsonb, $23, $24
      )
      RETURNING *
      `,
      [
        maternity_enrollment_id,
        patient_id,
        scan_date,
        gestational_age,
        scan_type,
        number_of_fetuses || 1,
        fetal_viability,
        fetal_heartbeat,
        fetal_presentation,
        placenta_position,
        amniotic_fluid,
        afi,
        estimated_fetal_weight,
        biparietal_diameter,
        head_circumference,
        abdominal_circumference,
        femur_length,
        anomalies_detected,
        JSON.stringify(anomaliesList ?? []),
        eddByUltrasound,
        findings,
        JSON.stringify(findingsList ?? []),
        userId,
        image_path,
      ],
    );

    // If dating scan updated EDD, update enrollment
    if (eddByUltrasound) {
      await tenantDb.query(
        `
        UPDATE maternity_enrollments
        SET expected_delivery_date = $1, edd_method = 'Ultrasound', updated_at = NOW()
        WHERE id = $2
        `,
        [eddByUltrasound, maternity_enrollment_id],
      );
    }

    this.logger.log(`Created ultrasound scan for enrollment ${maternity_enrollment_id}`);
    return result[0];
  }

  async getEnrollmentUltrasoundScans(tenantDb: DataSource, enrollmentId: string) {
    const scans = await tenantDb.query(
      `
      SELECT 
        us.*,
        u.first_name || ' ' || u.last_name as performed_by_name
      FROM ultrasound_scans us
      LEFT JOIN users u ON u.id = us.performed_by
      WHERE us.maternity_enrollment_id = $1
      ORDER BY us.scan_date DESC
      `,
      [enrollmentId],
    );

    return { scans, total: scans.length };
  }

  async updateUltrasoundScan(tenantDb: DataSource, scanId: string, scanData: any) {
    const fields = Object.keys(scanData).filter((k) => scanData[k] !== undefined);
    
    if (fields.length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    if (scanData.anomalies_snomed !== undefined) {
      scanData.anomalies_snomed =
        scanData.anomalies_snomed === null
          ? null
          : JSON.stringify(await this.normalizeConceptArray(tenantDb, scanData.anomalies_snomed));
    }
    if (scanData.findings_snomed !== undefined) {
      scanData.findings_snomed =
        scanData.findings_snomed === null
          ? null
          : JSON.stringify(await this.normalizeConceptArray(tenantDb, scanData.findings_snomed));
    }

    const jsonFields = new Set(['anomalies_snomed', 'findings_snomed']);

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}${jsonFields.has(field) ? '::jsonb' : ''}`)
      .join(', ');
    const values = fields.map((field) => scanData[field]);
    values.push(scanId);

    const result = await tenantDb.query(
      `
      UPDATE ultrasound_scans
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
      `,
      values,
    );

    if (result.length === 0) {
      throw new NotFoundException(`Ultrasound scan with ID ${scanId} not found`);
    }

    this.logger.log(`Updated ultrasound scan ${scanId}`);
    return result[0];
  }

  // ===== DELIVERIES =====

  async createDelivery(tenantDb: DataSource, deliveryData: any, userId?: string) {
    const precheck = await this.precheckDelivery(tenantDb, deliveryData);
    this.assertPrecheckAllowsPersistence(
      precheck,
      deliveryData?.safety_warnings_acknowledged,
      'Delivery',
    );

    const {
      maternity_enrollment_id,
      patient_id,
      delivery_date,
      delivery_time,
      indication_snomed,
      maternal_complications_snomed,
      ...deliveryFields
    } = deliveryData;

    if (!delivery_time || String(delivery_time).trim() === '') {
      throw new BadRequestException('Delivery time is required');
    }

    // Calculate gestational age at delivery
    const enrollment = await tenantDb.query(
      `SELECT lmp_date FROM maternity_enrollments WHERE id = $1`,
      [maternity_enrollment_id],
    );

    let gestationalAgeAtDelivery = null;
    let gestationalAgeDays = null;

    if (enrollment.length > 0 && enrollment[0].lmp_date) {
      const lmp = new Date(enrollment[0].lmp_date);
      const deliveryDateObj = new Date(delivery_date);
      const diffTime = Math.abs(deliveryDateObj.getTime() - lmp.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      gestationalAgeAtDelivery = Math.floor(diffDays / 7);
      gestationalAgeDays = diffDays % 7;
    }

    const indicationConcept = await this.resolveConcept(tenantDb, indication_snomed);
    const maternalComplicationsList = await this.normalizeConceptArray(
      tenantDb,
      maternal_complications_snomed,
    );

    const result = await tenantDb.query(
      `
      INSERT INTO deliveries (
        maternity_enrollment_id, patient_id, delivery_date, delivery_time,
        gestational_age_at_delivery, gestational_age_days, admission_date,
        delivery_type, delivery_method, indication_for_intervention,
        indication_snomed_code, indication_snomed_term, indication_snomed_module_id,
        indication_snomed_definition_status, labor_onset, induction_method,
        duration_of_labor_hours, rupture_of_membranes, membrane_rupture_type,
        anesthesia_type, episiotomy, perineal_tear_degree, blood_loss,
        placenta_delivery, placenta_complete, maternal_complications,
        maternal_complications_snomed, maternal_outcome,
        attending_provider, assistant_provider, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26,
        $27::jsonb, $28, $29, $30
      )
      RETURNING *
      `,
      [
        maternity_enrollment_id,
        patient_id,
        delivery_date,
        delivery_time,
        gestationalAgeAtDelivery,
        gestationalAgeDays,
        deliveryFields.admission_date,
        deliveryFields.delivery_type,
        deliveryFields.delivery_method,
        deliveryFields.indication_for_intervention || indicationConcept?.term || null,
        indicationConcept?.conceptId ?? null,
        indicationConcept?.term ?? null,
        indicationConcept?.moduleId ?? null,
        indicationConcept?.definitionStatus ?? null,
        deliveryFields.labor_onset,
        deliveryFields.induction_method,
        deliveryFields.duration_of_labor_hours,
        deliveryFields.rupture_of_membranes,
        deliveryFields.membrane_rupture_type,
        deliveryFields.anesthesia_type,
        deliveryFields.episiotomy,
        deliveryFields.perineal_tear_degree,
        deliveryFields.blood_loss,
        deliveryFields.placenta_delivery,
        deliveryFields.placenta_complete,
        deliveryFields.maternal_complications,
        JSON.stringify(maternalComplicationsList ?? []),
        deliveryFields.maternal_outcome || 'alive_well',
        deliveryFields.attending_provider || userId,
        deliveryFields.assistant_provider,
        deliveryFields.notes,
      ],
    );

    // Update enrollment status
    await tenantDb.query(
      `
      UPDATE maternity_enrollments
      SET enrollment_status = 'delivered', updated_at = NOW()
      WHERE id = $1
      `,
      [maternity_enrollment_id],
    );

    const createdDelivery = result[0];
    await this.createEscalationTaskFromPrecheck(tenantDb, {
      enrollmentId: maternity_enrollment_id,
      patientId: patient_id,
      sourceType: 'delivery',
      sourceRecordId: createdDelivery.id,
      createdBy: userId,
      title: 'Delivery event requires senior review',
      summary: `Delivery recorded on ${delivery_date} triggered maternity safety escalation.`,
      precheck,
      taskContext: {
        deliveryDate: delivery_date,
        deliveryType: deliveryFields.delivery_type,
      },
    });

    this.logger.log(`Created delivery record for enrollment ${maternity_enrollment_id}`);
    return createdDelivery;
  }

  async getDeliveryById(tenantDb: DataSource, deliveryId: string) {
    const delivery = await tenantDb.query(
      `
      SELECT 
        d.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        att_u.first_name || ' ' || att_u.last_name as attending_provider_name,
        ass_u.first_name || ' ' || ass_u.last_name as assistant_provider_name
      FROM deliveries d
      INNER JOIN patients p ON p.id = d.patient_id
      LEFT JOIN users att_u ON att_u.id = d.attending_provider
      LEFT JOIN users ass_u ON ass_u.id = d.assistant_provider
      WHERE d.id = $1
      `,
      [deliveryId],
    );

    if (delivery.length === 0) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    // Get birth outcomes
    const birthOutcomes = await tenantDb.query(
      `SELECT * FROM birth_outcomes WHERE delivery_id = $1 ORDER BY birth_order`,
      [deliveryId],
    );

    return {
      ...delivery[0],
      birth_outcomes: birthOutcomes,
    };
  }

  async getEnrollmentDelivery(tenantDb: DataSource, enrollmentId: string) {
    const delivery = await tenantDb.query(
      `
      SELECT 
        d.*,
        att_u.first_name || ' ' || att_u.last_name as attending_provider_name
      FROM deliveries d
      LEFT JOIN users att_u ON att_u.id = d.attending_provider
      WHERE d.maternity_enrollment_id = $1
      ORDER BY d.delivery_date DESC
      LIMIT 1
      `,
      [enrollmentId],
    );

    return delivery.length > 0 ? delivery[0] : null;
  }

  async updateDelivery(tenantDb: DataSource, deliveryId: string, deliveryData: any) {
    const fields = Object.keys(deliveryData).filter((k) => deliveryData[k] !== undefined);
    
    if (fields.length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    if (deliveryData.maternal_complications_snomed !== undefined) {
      deliveryData.maternal_complications_snomed =
        deliveryData.maternal_complications_snomed === null
          ? null
          : JSON.stringify(
              await this.normalizeConceptArray(tenantDb, deliveryData.maternal_complications_snomed),
            );
    }

    if (deliveryData.indication_snomed !== undefined) {
      const resolvedIndication = await this.resolveConcept(tenantDb, deliveryData.indication_snomed);
      deliveryData.indication_snomed_code = resolvedIndication?.conceptId ?? null;
      deliveryData.indication_snomed_term = resolvedIndication?.term ?? null;
      deliveryData.indication_snomed_module_id = resolvedIndication?.moduleId ?? null;
      deliveryData.indication_snomed_definition_status = resolvedIndication?.definitionStatus ?? null;
      if (resolvedIndication?.term) {
        deliveryData.indication_for_intervention =
          deliveryData.indication_for_intervention ?? resolvedIndication.term;
      }
      delete deliveryData.indication_snomed;
      if (!fields.includes('indication_snomed_code')) {
        fields.push('indication_snomed_code');
      }
      if (!fields.includes('indication_snomed_term')) {
        fields.push('indication_snomed_term');
      }
      if (!fields.includes('indication_snomed_module_id')) {
        fields.push('indication_snomed_module_id');
      }
      if (!fields.includes('indication_snomed_definition_status')) {
        fields.push('indication_snomed_definition_status');
      }
      if (!fields.includes('indication_for_intervention') && resolvedIndication?.term) {
        fields.push('indication_for_intervention');
      }
    }

    const jsonFields = new Set(['maternal_complications_snomed']);

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}${jsonFields.has(field) ? '::jsonb' : ''}`)
      .join(', ');
    const values = fields.map((field) => deliveryData[field]);
    values.push(deliveryId);

    const result = await tenantDb.query(
      `
      UPDATE deliveries
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
      `,
      values,
    );

    if (result.length === 0) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    this.logger.log(`Updated delivery ${deliveryId}`);
    return result[0];
  }

  async createBirthOutcome(tenantDb: DataSource, deliveryId: string, birthData: any) {
    const precheck = await this.precheckBirthOutcome(tenantDb, {
      delivery_id: deliveryId,
      ...birthData,
    });
    this.assertPrecheckAllowsPersistence(
      precheck,
      birthData?.safety_warnings_acknowledged,
      'Birth outcome',
    );

    const deliveryRows = await tenantDb.query(
      `SELECT maternity_enrollment_id, patient_id FROM deliveries WHERE id = $1 LIMIT 1`,
      [deliveryId],
    );
    const delivery = deliveryRows[0] || null;

    const {
      birth_order,
      birth_outcome,
      sex,
      birth_weight,
      birth_length,
      head_circumference,
      apgar_1min,
      apgar_5min,
      apgar_10min,
      resuscitation_required,
      resuscitation_type,
      congenital_anomalies,
      neonatal_complications,
      congenital_anomalies_snomed,
      neonatal_complications_snomed,
      breastfeeding_initiated,
      breastfeeding_within_1hour,
      vitamin_k_given,
      eye_prophylaxis_given,
      newborn_outcome,
      time_of_death,
      cause_of_death,
      cause_of_death_snomed,
    } = birthData;

    const congenitalConcepts = await this.normalizeConceptArray(
      tenantDb,
      congenital_anomalies_snomed,
    );
    const neonatalComplicationConcepts = await this.normalizeConceptArray(
      tenantDb,
      neonatal_complications_snomed,
    );
    const causeOfDeathConcept = await this.resolveConcept(tenantDb, cause_of_death_snomed);

    const result = await tenantDb.query(
      `
      INSERT INTO birth_outcomes (
        delivery_id, birth_order, birth_outcome, sex, birth_weight,
        birth_length, head_circumference, apgar_1min, apgar_5min, apgar_10min,
        resuscitation_required, resuscitation_type, congenital_anomalies,
        congenital_anomalies_snomed, neonatal_complications, neonatal_complications_snomed,
        breastfeeding_initiated, breastfeeding_within_1hour,
        vitamin_k_given, eye_prophylaxis_given, newborn_outcome,
        time_of_death, cause_of_death, cause_of_death_snomed_code,
        cause_of_death_snomed_term, cause_of_death_snomed_module_id,
        cause_of_death_snomed_definition_status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb,
        $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *
      `,
      [
        deliveryId,
        birth_order || 1,
        birth_outcome || 'live_birth',
        sex,
        birth_weight,
        birth_length,
        head_circumference,
        apgar_1min,
        apgar_5min,
        apgar_10min,
        resuscitation_required,
        resuscitation_type,
        congenital_anomalies,
        JSON.stringify(congenitalConcepts ?? []),
        neonatal_complications,
        JSON.stringify(neonatalComplicationConcepts ?? []),
        breastfeeding_initiated,
        breastfeeding_within_1hour,
        vitamin_k_given,
        eye_prophylaxis_given,
        newborn_outcome || 'alive_well',
        time_of_death,
        cause_of_death || causeOfDeathConcept?.term || null,
        causeOfDeathConcept?.conceptId ?? null,
        causeOfDeathConcept?.term ?? null,
        causeOfDeathConcept?.moduleId ?? null,
        causeOfDeathConcept?.definitionStatus ?? null,
      ],
    );

    const createdBirthOutcome = result[0];
    if (delivery) {
      await this.createEscalationTaskFromPrecheck(tenantDb, {
        enrollmentId: delivery.maternity_enrollment_id,
        patientId: delivery.patient_id,
        sourceType: 'delivery',
        sourceRecordId: deliveryId,
        title: 'Birth outcome requires doctor review',
        summary: `Birth outcome #${birth_order || 1} triggered neonatal or maternal follow-up workflow.`,
        precheck,
        taskContext: {
          birthOutcomeId: createdBirthOutcome.id,
          birthOrder: birth_order || 1,
          birthOutcome: birth_outcome || 'live_birth',
        },
      });
    }

    this.logger.log(`Created birth outcome for delivery ${deliveryId}, birth order ${birth_order || 1}`);
    return createdBirthOutcome;
  }

  // ===== POSTNATAL VISITS =====

  async createPostnatalVisit(tenantDb: DataSource, visitData: any, userId?: string) {
    const precheck = await this.precheckPostnatalVisit(tenantDb, visitData);
    this.assertPrecheckAllowsPersistence(
      precheck,
      visitData?.safety_warnings_acknowledged,
      'Postnatal visit',
    );

    const {
      maternity_enrollment_id,
      delivery_id,
      patient_id,
      visit_date,
      danger_signs_snomed,
      family_planning_method_snomed,
      newborn_complications_snomed,
      ...vitalFields
    } = visitData;

    // Calculate days postpartum
    let daysPostpartum = null;
    if (delivery_id) {
      const delivery = await tenantDb.query(
        `SELECT delivery_date FROM deliveries WHERE id = $1`,
        [delivery_id],
      );

      if (delivery.length > 0) {
        const deliveryDate = new Date(delivery[0].delivery_date);
        const visitDateObj = new Date(visit_date);
        const diffTime = Math.abs(visitDateObj.getTime() - deliveryDate.getTime());
        daysPostpartum = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    const dangerSignsList = await this.normalizeConceptArray(tenantDb, danger_signs_snomed);
    const newbornCompConcepts = await this.normalizeConceptArray(
      tenantDb,
      newborn_complications_snomed,
    );
    const familyPlanningConcept = await this.resolveConcept(
      tenantDb,
      family_planning_method_snomed,
    );
    const vitalsProvenance = await this.validateVitalsProvenanceForPersistence(tenantDb, {
      patientId: patient_id,
      visitDate: visit_date,
      context: 'postnatal',
      sourceVitalId: vitalFields.vitals_source_vital_id,
      autoPopulatedAt: vitalFields.vitals_auto_populated_at,
      overridden: vitalFields.vitals_overridden,
      overrideReason: vitalFields.vitals_override_reason,
    });

    const result = await tenantDb.query(
      `
      INSERT INTO postnatal_visits (
        maternity_enrollment_id, delivery_id, patient_id, visit_date,
        days_postpartum, weight, blood_pressure_systolic, blood_pressure_diastolic,
        temperature, pulse, general_condition, uterine_involution, lochia,
        perineum_condition, breast_condition, breastfeeding_status,
        breastfeeding_problems, emotional_status, danger_signs,
        danger_signs_snomed, family_planning_discussed, family_planning_method,
        family_planning_method_snomed_code, family_planning_method_snomed_term,
        family_planning_method_snomed_module_id, family_planning_method_snomed_definition_status,
        newborn_status, newborn_complications, newborn_complications_snomed,
        provider, notes, next_visit_date,
        vitals_source_vital_id, vitals_auto_populated_at, vitals_overridden, vitals_override_reason
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20::jsonb, $21, $22, $23, $24, $25, $26,
        $27, $28, $29::jsonb, $30, $31, $32, $33, $34, $35, $36
      )
      RETURNING *
      `,
      [
        maternity_enrollment_id,
        delivery_id,
        patient_id,
        visit_date,
        daysPostpartum,
        vitalFields.weight,
        vitalFields.blood_pressure_systolic,
        vitalFields.blood_pressure_diastolic,
        vitalFields.temperature,
        vitalFields.pulse,
        vitalFields.general_condition,
        vitalFields.uterine_involution,
        vitalFields.lochia,
        vitalFields.perineum_condition,
        vitalFields.breast_condition,
        vitalFields.breastfeeding_status,
        vitalFields.breastfeeding_problems,
        vitalFields.emotional_status,
        vitalFields.danger_signs,
        JSON.stringify(dangerSignsList ?? []),
        vitalFields.family_planning_discussed,
        vitalFields.family_planning_method || familyPlanningConcept?.term || null,
        familyPlanningConcept?.conceptId ?? null,
        familyPlanningConcept?.term ?? null,
        familyPlanningConcept?.moduleId ?? null,
        familyPlanningConcept?.definitionStatus ?? null,
        vitalFields.newborn_status,
        vitalFields.newborn_complications,
        JSON.stringify(newbornCompConcepts ?? []),
        userId,
        vitalFields.notes,
        vitalFields.next_visit_date,
        vitalsProvenance.sourceVitalId,
        vitalsProvenance.autoPopulatedAt,
        vitalsProvenance.overridden,
        vitalsProvenance.overrideReason,
      ],
    );

    const createdVisit = result[0];

    await this.createEscalationTaskFromPrecheck(tenantDb, {
      enrollmentId: maternity_enrollment_id,
      patientId: patient_id,
      sourceType: 'postnatal_visit',
      sourceRecordId: createdVisit.id,
      createdBy: userId,
      title: 'Postnatal visit requires doctor review',
      summary: `Postnatal visit recorded on ${visit_date} triggered maternity safety escalation.`,
      precheck,
      taskContext: {
        visitDate: visit_date,
        daysPostpartum,
      },
    });

    this.logger.log(`Created postnatal visit for enrollment ${maternity_enrollment_id}, day ${daysPostpartum}`);
    return createdVisit;
  }

  async getEnrollmentPostnatalVisits(tenantDb: DataSource, enrollmentId: string) {
    const visits = await tenantDb.query(
      `
      SELECT 
        pv.*,
        u.first_name || ' ' || u.last_name as provider_name
      FROM postnatal_visits pv
      LEFT JOIN users u ON u.id = pv.provider
      WHERE pv.maternity_enrollment_id = $1
      ORDER BY pv.visit_date
      `,
      [enrollmentId],
    );

    return { visits, total: visits.length };
  }

  async updatePostnatalVisit(tenantDb: DataSource, visitId: string, visitData: any) {
    const fields = Object.keys(visitData).filter((k) => visitData[k] !== undefined);
    
    if (fields.length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    if (visitData.danger_signs_snomed !== undefined) {
      visitData.danger_signs_snomed =
        visitData.danger_signs_snomed === null
          ? null
          : JSON.stringify(await this.normalizeConceptArray(tenantDb, visitData.danger_signs_snomed));
    }

    if (visitData.newborn_complications_snomed !== undefined) {
      visitData.newborn_complications_snomed =
        visitData.newborn_complications_snomed === null
          ? null
          : JSON.stringify(
              await this.normalizeConceptArray(tenantDb, visitData.newborn_complications_snomed),
            );
    }

    if (visitData.family_planning_method_snomed !== undefined) {
      const resolvedFp = await this.resolveConcept(tenantDb, visitData.family_planning_method_snomed);
      visitData.family_planning_method_snomed_code = resolvedFp?.conceptId ?? null;
      visitData.family_planning_method_snomed_term = resolvedFp?.term ?? null;
      visitData.family_planning_method_snomed_module_id = resolvedFp?.moduleId ?? null;
      visitData.family_planning_method_snomed_definition_status =
        resolvedFp?.definitionStatus ?? null;
      if (resolvedFp?.term) {
        visitData.family_planning_method = visitData.family_planning_method ?? resolvedFp.term;
      }
      delete visitData.family_planning_method_snomed;
      if (!fields.includes('family_planning_method_snomed_code')) {
        fields.push('family_planning_method_snomed_code');
      }
      if (!fields.includes('family_planning_method_snomed_term')) {
        fields.push('family_planning_method_snomed_term');
      }
      if (!fields.includes('family_planning_method_snomed_module_id')) {
        fields.push('family_planning_method_snomed_module_id');
      }
      if (!fields.includes('family_planning_method_snomed_definition_status')) {
        fields.push('family_planning_method_snomed_definition_status');
      }
      if (!fields.includes('family_planning_method') && resolvedFp?.term) {
        fields.push('family_planning_method');
      }
    }

    const jsonFields = new Set(['danger_signs_snomed', 'newborn_complications_snomed']);

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}${jsonFields.has(field) ? '::jsonb' : ''}`)
      .join(', ');
    const values = fields.map((field) => visitData[field]);
    values.push(visitId);

    const result = await tenantDb.query(
      `
      UPDATE postnatal_visits
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
      `,
      values,
    );

    if (result.length === 0) {
      throw new NotFoundException(`Postnatal visit with ID ${visitId} not found`);
    }

    this.logger.log(`Updated postnatal visit ${visitId}`);
    return result[0];
  }

  // ===== RISK FACTORS =====

  async addRiskFactor(tenantDb: DataSource, enrollmentId: string, riskData: any, userId?: string) {
    const { risk_factor, risk_category, severity, identified_date, notes, risk_factor_snomed } = riskData;

    const enrollmentRows = await tenantDb.query(
      `SELECT patient_id FROM maternity_enrollments WHERE id = $1 LIMIT 1`,
      [enrollmentId],
    );
    if (enrollmentRows.length === 0) {
      throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
    }

    const riskConcept = await this.resolveConcept(tenantDb, risk_factor_snomed);

    const result = await tenantDb.query(
      `
      INSERT INTO maternity_risk_factors (
        maternity_enrollment_id, risk_factor, risk_category, severity,
        identified_date, notes, created_by,
        risk_factor_snomed_code, risk_factor_snomed_term,
        risk_factor_snomed_module_id, risk_factor_snomed_definition_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        enrollmentId,
        risk_factor || riskConcept?.term || null,
        risk_category,
        severity,
        identified_date,
        notes,
        userId,
        riskConcept?.conceptId ?? null,
        riskConcept?.term ?? null,
        riskConcept?.moduleId ?? null,
        riskConcept?.definitionStatus ?? null,
      ],
    );

    // Update enrollment risk category if this is high severity
    if (severity === 'high') {
      await tenantDb.query(
        `
        UPDATE maternity_enrollments
        SET risk_category = 'high', updated_at = NOW()
        WHERE id = $1 AND risk_category != 'high'
        `,
        [enrollmentId],
      );
    }

    if (severity === 'high') {
      await this.upsertMaternityCareTask(tenantDb, {
        enrollmentId,
        patientId: enrollmentRows[0].patient_id,
        sourceType: 'risk_factor',
        sourceRecordId: result[0].id,
        createdBy: userId,
        title: 'High-severity maternity risk factor requires review',
        summary: `${risk_factor || riskConcept?.term || 'High-severity risk factor'} was added to the maternity record.`,
        priority: 'high',
        warningCount: 1,
        requiredActions: ['Doctor review and documented management plan required.'],
        taskContext: {
          riskCategory: risk_category,
          severity,
          identifiedDate: identified_date,
        },
      });
    }

    this.logger.log(`Added risk factor to enrollment ${enrollmentId}: ${risk_factor}`);
    return result[0];
  }

  async getEnrollmentRiskFactors(tenantDb: DataSource, enrollmentId: string) {
    const riskFactors = await tenantDb.query(
      `
      SELECT 
        rf.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM maternity_risk_factors rf
      LEFT JOIN users u ON u.id = rf.created_by
      WHERE rf.maternity_enrollment_id = $1
        AND rf.resolved_date IS NULL
      ORDER BY rf.severity DESC, rf.identified_date DESC
      `,
      [enrollmentId],
    );

    return { riskFactors, total: riskFactors.length };
  }

  async getMaternityCareTasks(
    tenantDb: DataSource,
    filters: MaternityCareTaskFilters = {},
  ) {
    const params: any[] = [];
    const whereClauses: string[] = ['1=1'];

    if (filters.enrollmentId) {
      params.push(filters.enrollmentId);
      whereClauses.push(`t.maternity_enrollment_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      whereClauses.push(`t.status = $${params.length}`);
    } else {
      whereClauses.push(`t.status != 'closed'`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      whereClauses.push(`t.priority = $${params.length}`);
    }

    const tasks = await tenantDb.query(
      `
      SELECT
        t.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        me.enrollment_number,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        ack_u.first_name || ' ' || ack_u.last_name as acknowledged_by_name,
        action_u.first_name || ' ' || action_u.last_name as actioned_by_name,
        close_u.first_name || ' ' || close_u.last_name as closed_by_name
      FROM maternity_care_tasks t
      INNER JOIN patients p ON p.id = t.patient_id
      INNER JOIN maternity_enrollments me ON me.id = t.maternity_enrollment_id
      LEFT JOIN users creator ON creator.id = t.created_by
      LEFT JOIN users ack_u ON ack_u.id = t.acknowledged_by
      LEFT JOIN users action_u ON action_u.id = t.actioned_by
      LEFT JOIN users close_u ON close_u.id = t.closed_by
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END DESC,
        t.last_event_at DESC,
        t.created_at DESC
      `,
      params,
    );

    return { tasks, total: tasks.length };
  }

  async getEnrollmentMaternityCareTasks(tenantDb: DataSource, enrollmentId: string) {
    return this.getMaternityCareTasks(tenantDb, { enrollmentId, status: undefined });
  }

  async updateMaternityCareTaskStatus(
    tenantDb: DataSource,
    taskId: string,
    body: {
      status?: MaternityCareTaskStatus;
      note?: string;
      assigned_to?: string;
    },
    actorId?: string | null,
  ) {
    const nextStatus = this.normalizeString(body?.status) as MaternityCareTaskStatus | null;
    if (!nextStatus || !['open', 'acknowledged', 'actioned', 'closed'].includes(nextStatus)) {
      throw new BadRequestException('Valid maternity care task status is required.');
    }

    const existingRows = await tenantDb.query(
      `SELECT id, status FROM maternity_care_tasks WHERE id = $1 LIMIT 1`,
      [taskId],
    );
    if (existingRows.length === 0) {
      throw new NotFoundException(`Maternity care task with ID ${taskId} not found`);
    }

    const currentStatus = existingRows[0].status as MaternityCareTaskStatus;
    const allowedTransitions: Record<MaternityCareTaskStatus, MaternityCareTaskStatus[]> = {
      open: ['acknowledged', 'actioned', 'closed'],
      acknowledged: ['actioned', 'closed'],
      actioned: ['closed'],
      closed: [],
    };

    if (currentStatus !== nextStatus && !allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot move maternity care task from ${currentStatus} to ${nextStatus}.`,
      );
    }

    const note = this.normalizeString(body?.note);
    const assignedTo = this.normalizeString(body?.assigned_to);

    const result = await tenantDb.query(
      `
      UPDATE maternity_care_tasks
      SET status = $1,
          assigned_to = COALESCE($2, assigned_to),
          latest_note = COALESCE($3, latest_note),
          acknowledged_by = CASE WHEN $1 = 'acknowledged' THEN $4 ELSE acknowledged_by END,
          acknowledged_at = CASE WHEN $1 = 'acknowledged' AND acknowledged_at IS NULL THEN NOW() ELSE acknowledged_at END,
          actioned_by = CASE WHEN $1 = 'actioned' THEN $4 ELSE actioned_by END,
          actioned_at = CASE WHEN $1 = 'actioned' AND actioned_at IS NULL THEN NOW() ELSE actioned_at END,
          closed_by = CASE WHEN $1 = 'closed' THEN $4 ELSE closed_by END,
          closed_at = CASE WHEN $1 = 'closed' AND closed_at IS NULL THEN NOW() ELSE closed_at END,
          closed_reason = CASE WHEN $1 = 'closed' THEN COALESCE($3, closed_reason) ELSE closed_reason END,
          last_event_at = NOW(),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [nextStatus, assignedTo, note, actorId || null, taskId],
    );

    return result[0];
  }

  // ===== INDICATORS & REPORTS =====

  async getMaternityIndicators(tenantDb: DataSource, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const dateFilter =
      startDate && endDate
        ? `AND me.enrollment_date BETWEEN $1::date AND $2::date`
        : `AND me.enrollment_date > CURRENT_DATE - INTERVAL '12 months'`;
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }

    const indicators = await tenantDb.query(
      `
      SELECT 
        COUNT(DISTINCT me.id) as total_enrollments,
        COUNT(DISTINCT me.id) FILTER (WHERE me.enrollment_status = 'active') as active_pregnancies,
        COUNT(DISTINCT me.id) FILTER (WHERE me.enrollment_status = 'delivered') as total_deliveries,
        COUNT(DISTINCT me.id) FILTER (WHERE me.risk_category = 'high') as high_risk_count,
        COUNT(DISTINCT d.id) as deliveries_count,
        COUNT(DISTINCT d.id) FILTER (WHERE d.delivery_type = 'spontaneous_vaginal') as vaginal_deliveries,
        COUNT(DISTINCT d.id) FILTER (WHERE d.delivery_type = 'cesarean') as cesarean_deliveries,
        COUNT(DISTINCT bo.id) FILTER (WHERE bo.birth_outcome = 'live_birth') as live_births,
        COUNT(DISTINCT bo.id) FILTER (WHERE bo.birth_outcome = 'stillbirth') as stillbirths,
        COUNT(DISTINCT me.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM anc_visits av 
            WHERE av.maternity_enrollment_id = me.id 
            GROUP BY av.maternity_enrollment_id 
            HAVING COUNT(*) >= 4
          )
        ) as anc_4plus_visits,
        AVG(bo.birth_weight) FILTER (WHERE bo.birth_outcome = 'live_birth') as avg_birth_weight,
        COUNT(DISTINCT bo.id) FILTER (WHERE bo.birth_weight < 2.5 AND bo.birth_outcome = 'live_birth') as low_birth_weight_count
      FROM maternity_enrollments me
      LEFT JOIN deliveries d ON d.maternity_enrollment_id = me.id
      LEFT JOIN birth_outcomes bo ON bo.delivery_id = d.id
      WHERE 1=1 ${dateFilter}
      `,
      params,
    );

    return indicators[0];
  }

  async getDeliverySummary(tenantDb: DataSource, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const dateFilter =
      startDate && endDate
        ? `WHERE d.delivery_date BETWEEN $1::date AND $2::date`
        : `WHERE d.delivery_date > CURRENT_DATE - INTERVAL '3 months'`;
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }

    const summary = await tenantDb.query(
      `
      SELECT 
        d.delivery_type,
        COUNT(*) as count,
        AVG(d.duration_of_labor_hours) as avg_labor_duration,
        AVG(d.blood_loss) as avg_blood_loss,
        COUNT(*) FILTER (WHERE d.maternal_complications IS NOT NULL AND d.maternal_complications != '') as complications_count
      FROM deliveries d
      ${dateFilter}
      GROUP BY d.delivery_type
      ORDER BY count DESC
      `,
      params,
    );

    return { summary, total: summary.length };
  }

  async getANCCoverage(tenantDb: DataSource, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const dateFilter =
      startDate && endDate
        ? `AND me.enrollment_date BETWEEN $1::date AND $2::date`
        : `AND me.enrollment_date > CURRENT_DATE - INTERVAL '12 months'`;
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }

    const coverage = await tenantDb.query(
      `
      SELECT 
        COUNT(DISTINCT me.id) as total_enrolled,
        COUNT(DISTINCT me.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM anc_visits av WHERE av.maternity_enrollment_id = me.id)
        ) as at_least_1_visit,
        COUNT(DISTINCT me.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM anc_visits av 
            WHERE av.maternity_enrollment_id = me.id 
            GROUP BY av.maternity_enrollment_id 
            HAVING COUNT(*) >= 4
          )
        ) as at_least_4_visits,
        COUNT(DISTINCT me.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM anc_visits av 
            WHERE av.maternity_enrollment_id = me.id 
            GROUP BY av.maternity_enrollment_id 
            HAVING COUNT(*) >= 8
          )
        ) as at_least_8_visits
      FROM maternity_enrollments me
      WHERE 1=1 ${dateFilter}
      `,
      params,
    );

    const result = coverage[0];
    const total = parseInt(result.total_enrolled || 0);

    return {
      ...result,
      coverage_1plus: total > 0 ? ((result.at_least_1_visit / total) * 100).toFixed(1) : 0,
      coverage_4plus: total > 0 ? ((result.at_least_4_visits / total) * 100).toFixed(1) : 0,
      coverage_8plus: total > 0 ? ((result.at_least_8_visits / total) * 100).toFixed(1) : 0,
    };
  }

  async getHighRiskPregnancies(tenantDb: DataSource) {
    const highRisk = await tenantDb.query(
      `
      SELECT 
        me.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.phone,
        CASE
          WHEN me.expected_delivery_date IS NOT NULL
            THEN (me.expected_delivery_date::date - CURRENT_DATE::date)
          ELSE NULL
        END as days_to_edd,
        MAX(av.visit_date) as last_anc_visit_date,
        COUNT(DISTINCT rf.id) as risk_factor_count
      FROM maternity_enrollments me
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN anc_visits av ON av.maternity_enrollment_id = me.id
      LEFT JOIN maternity_risk_factors rf ON rf.maternity_enrollment_id = me.id AND rf.resolved_date IS NULL
      WHERE me.risk_category = 'high'
        AND me.enrollment_status = 'active'
      GROUP BY me.id, p.id
      ORDER BY me.expected_delivery_date NULLS LAST
      `,
    );

    return { pregnancies: highRisk, total: highRisk.length };
  }

  async getUpcomingDeliveries(tenantDb: DataSource) {
    const upcoming = await tenantDb.query(
      `
      SELECT 
        me.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.phone,
        CASE
          WHEN me.expected_delivery_date IS NOT NULL
            THEN (me.expected_delivery_date::date - CURRENT_DATE::date)
          ELSE NULL
        END as days_to_edd,
        MAX(av.visit_date) as last_anc_visit_date,
        COUNT(DISTINCT av.id) as anc_visit_count
      FROM maternity_enrollments me
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN anc_visits av ON av.maternity_enrollment_id = me.id
      WHERE me.enrollment_status = 'active'
        AND me.expected_delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      GROUP BY me.id, p.id
      ORDER BY me.expected_delivery_date
      `,
    );

    return { deliveries: upcoming, total: upcoming.length };
  }

  async getOverdueANCVisits(tenantDb: DataSource) {
    const overdue = await tenantDb.query(
      `
      SELECT 
        me.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.phone,
        MAX(av.next_visit_date) as next_visit_date,
        MAX(av.visit_date) as last_visit_date,
        CASE
          WHEN MAX(av.next_visit_date) IS NOT NULL
            THEN (CURRENT_DATE::date - MAX(av.next_visit_date)::date)
          ELSE NULL
        END as days_overdue
      FROM maternity_enrollments me
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN anc_visits av ON av.maternity_enrollment_id = me.id
      WHERE me.enrollment_status = 'active'
      GROUP BY me.id, p.id
      HAVING MAX(av.next_visit_date) < CURRENT_DATE
      ORDER BY days_overdue DESC
      `,
    );

    return { patients: overdue, total: overdue.length };
  }

  async getRecentNeonatalOutcomes(tenantDb: DataSource) {
    const outcomes = await tenantDb.query(
      `
      SELECT 
        bo.id,
        bo.delivery_id,
        bo.birth_order,
        bo.birth_outcome,
        bo.newborn_outcome,
        bo.birth_weight,
        bo.resuscitation_required,
        bo.neonatal_complications,
        bo.time_of_death,
        me.id as enrollment_id,
        me.patient_id,
        p.first_name || ' ' || p.last_name as patient_name,
        d.delivery_date
      FROM birth_outcomes bo
      INNER JOIN deliveries d ON d.id = bo.delivery_id
      INNER JOIN maternity_enrollments me ON me.id = d.maternity_enrollment_id
      INNER JOIN patients p ON p.id = me.patient_id
      WHERE d.delivery_date > CURRENT_DATE - INTERVAL '14 days'
      ORDER BY d.delivery_date DESC, bo.birth_order
      LIMIT 20
      `,
    );

    return { outcomes, total: outcomes.length };
  }

  async getRecentPostnatalVisits(tenantDb: DataSource) {
    const visits = await tenantDb.query(
      `
      SELECT 
        pv.*,
        me.id as enrollment_id,
        me.patient_id,
        p.first_name || ' ' || p.last_name as patient_name,
        d.delivery_date
      FROM postnatal_visits pv
      INNER JOIN maternity_enrollments me ON me.id = pv.maternity_enrollment_id
      INNER JOIN patients p ON p.id = me.patient_id
      LEFT JOIN deliveries d ON d.id = pv.delivery_id
      WHERE pv.visit_date > CURRENT_DATE - INTERVAL '14 days'
      ORDER BY pv.visit_date DESC
      LIMIT 20
      `,
    );

    return { visits, total: visits.length };
  }
}
