import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TerminologyService } from './terminology.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class MaternityService {
  private readonly logger = new Logger(MaternityService.name);

  constructor(private readonly terminologyService: TerminologyService) {}

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

    return {
      ...enrollment[0],
      anc_visits: ancVisits.visits || [],
      ultrasound_scans: ultrasounds.scans || [],
      delivery: delivery || null,
      postnatal_visits: postnatalVisits.visits || [],
      risk_factors: riskFactors.riskFactors || [],
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

  // ===== ANC VISITS =====

  async createANCVisit(tenantDb: DataSource, visitData: any, userId?: string) {
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
        referral_facility, next_visit_date, provider, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39::jsonb, $40, $41::jsonb,
        $42, $43, $44, $45, $46, $47, $48
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
      ],
    );

    this.logger.log(`Created ANC visit #${visit_number} for enrollment ${maternity_enrollment_id}`);
    return result[0];
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

    this.logger.log(`Created delivery record for enrollment ${maternity_enrollment_id}`);
    return result[0];
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
        $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25
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

    this.logger.log(`Created birth outcome for delivery ${deliveryId}, birth order ${birth_order || 1}`);
    return result[0];
  }

  // ===== POSTNATAL VISITS =====

  async createPostnatalVisit(tenantDb: DataSource, visitData: any, userId?: string) {
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
        provider, notes, next_visit_date
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19::jsonb, $20, $21, $22, $23, $24, $25, $26,
        $27::jsonb, $28, $29
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
      ],
    );

    this.logger.log(`Created postnatal visit for enrollment ${maternity_enrollment_id}, day ${daysPostpartum}`);
    return result[0];
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
