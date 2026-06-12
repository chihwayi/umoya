import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS, PaymentStatus } from '../constants/payment-status';
import { TerminologyService } from './terminology.service';
import { CdssService } from './cdss.service';
import { EcgRecord } from '../entities/ecg-record.entity';

interface CardiologyFilters {
  patientId?: string;
  cardiologistId?: string;
  paymentStatus?: string;
  careStatus?: string;
  riskScore?: string;
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
}

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class CardiologyService {
  private readonly logger = new Logger(CardiologyService.name);

  constructor(
    private readonly financeService: FinanceService,
    private readonly terminologyService: TerminologyService,
    private readonly cdssService: CdssService,
  ) {}

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
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for cardiology payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) || null;
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

  async listEncounters(tenantDb: DataSource, filters: CardiologyFilters = {}) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.patientId) {
      conditions.push(`ce.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }

    if (filters.cardiologistId) {
      conditions.push(`ce.cardiologist_id = $${params.length + 1}`);
      params.push(filters.cardiologistId);
    }

    if (filters.paymentStatus) {
      conditions.push(`ce.payment_status = $${params.length + 1}`);
      params.push(filters.paymentStatus);
    }

    if (filters.careStatus) {
      conditions.push(`ce.care_status = $${params.length + 1}`);
      params.push(filters.careStatus);
    }

    if (filters.riskScore) {
      conditions.push(`ce.risk_score = $${params.length + 1}`);
      params.push(filters.riskScore);
    }

    if (filters.fromDate) {
      conditions.push(`ce.encounter_date >= $${params.length + 1}`);
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push(`ce.encounter_date <= $${params.length + 1}`);
      params.push(filters.toDate);
    }

    if (filters.searchTerm) {
      const searchParam = `%${filters.searchTerm.toLowerCase()}%`;
      conditions.push(
        `(LOWER(p.first_name || ' ' || p.last_name) LIKE $${params.length + 1} OR LOWER(p.patient_number) LIKE $${params.length + 1})`,
      );
      params.push(searchParam);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await tenantDb.query(
      `
      SELECT
        ce.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        doc.first_name || ' ' || doc.last_name AS cardiologist_name
      FROM cardiology_encounters ce
      INNER JOIN patients p ON p.id = ce.patient_id
      LEFT JOIN users doc ON doc.id = ce.cardiologist_id
      ${whereClause}
      ORDER BY ce.encounter_date DESC
      LIMIT 200
      `,
      params,
    );

    return { encounters: rows, total: rows.length };
  }

  async createEncounter(tenantDb: DataSource, payload: any, userId?: string) {
    const {
      patient_id,
      encounter_date,
      encounter_type,
      cardiologist_id,
      visit_reason,
      presenting_symptoms,
      hemodynamics,
      diagnostic_tests,
      care_plan,
      follow_up_plan,
      risk_score,
      fee_amount,
      feeAmount,
      care_status,
      reason_concept,
      reasonConcept,
      symptom_concepts,
      symptomConcepts,
      diagnostic_concepts,
      diagnosticConcepts,
    } = payload;

    if (!patient_id || !encounter_date) {
      throw new BadRequestException('patient_id and encounter_date are required');
    }

    const rawFee = fee_amount ?? feeAmount ?? payload.estimated_fee ?? payload.estimatedFee ?? null;
    const parsedFee = rawFee !== null && rawFee !== undefined ? Number(rawFee) : Number.NaN;
    const defaultFee = process.env.DEFAULT_CARDIOLOGY_FEE !== undefined ? Number(process.env.DEFAULT_CARDIOLOGY_FEE) : 0;
    const feeValue = Number.isFinite(parsedFee) ? parsedFee : defaultFee;
    const feeAmountValue = Number.isFinite(feeValue) && feeValue > 0 ? feeValue : 0;

    let financeTransactionId: string | null = null;
    let paymentStatus: PaymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
    let careStatus: string = care_status || 'scheduled';

    if (feeAmountValue > 0) {
      const transaction = await this.financeService.createTransaction(
        tenantDb,
        {
          sourceModule: 'cardiology_encounters',
          patientId: patient_id,
          amount: feeAmountValue,
          currency: 'USD',
          notes: visit_reason ? `Cardiology encounter - ${visit_reason}` : 'Cardiology encounter',
          payerType: 'self',
          lineItems: [
            {
              description: visit_reason || 'Cardiology encounter',
              billingCode: 'CARDIO_CARE',
              unitPrice: feeAmountValue,
              quantity: 1,
            },
          ],
        },
        userId,
      );
      financeTransactionId = transaction.id;
      paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
      careStatus = 'awaiting_payment';
    }

    const hemodynamicsJson = hemodynamics ? JSON.stringify(hemodynamics) : '{}';
    const diagnosticTestsJson = diagnostic_tests ? JSON.stringify(diagnostic_tests) : '[]';
    const normalizedCardiologistId =
      typeof cardiologist_id === 'string' && cardiologist_id.trim().length > 0 ? cardiologist_id : null;
    const normalizedUserId = typeof userId === 'string' && userId.trim().length > 0 ? userId : null;
    const cardiologistIdValue = normalizedCardiologistId ?? normalizedUserId ?? null;

    const resolvedReasonConcept =
      (reason_concept === null || reasonConcept === null)
        ? null
        : await this.resolveConcept(tenantDb, reason_concept ?? reasonConcept);
    const symptomConceptList = await this.normalizeConceptArray(
      tenantDb,
      symptom_concepts ?? symptomConcepts,
    );
    const diagnosticConceptList = await this.normalizeConceptArray(
      tenantDb,
      diagnostic_concepts ?? diagnosticConcepts,
    );

    const [encounter] = await tenantDb.query(
      `
      INSERT INTO cardiology_encounters (
        patient_id,
        encounter_date,
        encounter_type,
        cardiologist_id,
        visit_reason,
        reason_snomed_code,
        reason_snomed_term,
        reason_snomed_module_id,
        reason_snomed_definition_status,
        presenting_symptoms,
        symptom_snomed_codes,
        hemodynamics,
        diagnostic_tests,
        diagnostic_snomed_codes,
        care_plan,
        follow_up_plan,
        risk_score,
        care_status,
        fee_amount,
        finance_transaction_id,
        payment_status,
        created_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2::timestamptz,
        $3::text,
        $4::uuid,
        $5::text,
        $6::varchar,
        $7::text,
        $8::text,
        $9::text,
        $10::text,
        $11::jsonb,
        $12::jsonb,
        $13::jsonb,
        $14::jsonb,
        $15::text,
        $16::text,
        $17::text,
        $18::text,
        $19::numeric,
        $20::uuid,
        $21::text,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        patient_id,
        encounter_date,
        encounter_type,
        cardiologistIdValue,
        visit_reason || resolvedReasonConcept?.term || null,
        resolvedReasonConcept?.conceptId ?? null,
        resolvedReasonConcept?.term ?? null,
        resolvedReasonConcept?.moduleId ?? null,
        resolvedReasonConcept?.definitionStatus ?? null,
        presenting_symptoms || null,
        JSON.stringify(symptomConceptList ?? []),
        hemodynamicsJson,
        diagnosticTestsJson,
        JSON.stringify(diagnosticConceptList ?? []),
        care_plan || null,
        follow_up_plan || null,
        risk_score || null,
        careStatus,
        feeAmountValue > 0 ? feeAmountValue : null,
        financeTransactionId,
        paymentStatus,
      ],
    );

    if (financeTransactionId) {
      await tenantDb.query(
        `
        UPDATE financial_transactions
        SET source_reference_id = $1
        WHERE id = $2
      `,
        [encounter.id, financeTransactionId],
      );
    }

    this.logger.log(`Created cardiology encounter ${encounter.id} for patient ${patient_id} (${paymentStatus})`);
    return encounter;
  }

  async updateEncounter(tenantDb: DataSource, encounterId: string, payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload required');
    }

    const [existing] = await tenantDb.query(
      `SELECT payment_status, care_status FROM cardiology_encounters WHERE id = $1`,
      [encounterId],
    );

    if (!existing) {
      throw new NotFoundException(`Cardiology encounter ${encounterId} not found`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    const jsonFields = new Map<string, any>([
      ['hemodynamics', payload.hemodynamics],
      ['diagnostic_tests', payload.diagnostic_tests],
    ]);

    jsonFields.forEach((value, key) => {
      if (value !== undefined) {
        updates.push(`${key} = $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(value ?? (key === 'hemodynamics' ? {} : [])));
      }
    });

    const textFields: Record<string, any> = {
      encounter_date: payload.encounter_date,
      encounter_type: payload.encounter_type,
      cardiologist_id: payload.cardiologist_id,
      visit_reason: payload.visit_reason,
      presenting_symptoms: payload.presenting_symptoms,
      care_plan: payload.care_plan,
      follow_up_plan: payload.follow_up_plan,
      risk_score: payload.risk_score,
    };

    Object.entries(textFields).forEach(([field, value]) => {
      if (value !== undefined) {
        if (field === 'cardiologist_id') {
          const normalized = typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
          updates.push(`${field} = $${params.length + 1}::uuid`);
          params.push(normalized);
        } else if (field === 'encounter_date') {
          updates.push(`${field} = $${params.length + 1}::timestamptz`);
          params.push(value);
        } else {
          updates.push(`${field} = $${params.length + 1}::text`);
          params.push(value);
        }
      }
    });

    if ('reason_concept' in payload || 'reasonConcept' in payload) {
      const reasonConceptValue =
        payload.reason_concept === null || payload.reasonConcept === null
          ? null
          : await this.resolveConcept(tenantDb, payload.reason_concept ?? payload.reasonConcept);
      updates.push(`reason_snomed_code = $${params.length + 1}`);
      params.push(reasonConceptValue?.conceptId ?? null);
      updates.push(`reason_snomed_term = $${params.length + 1}`);
      params.push(reasonConceptValue?.term ?? null);
      updates.push(`reason_snomed_module_id = $${params.length + 1}`);
      params.push(reasonConceptValue?.moduleId ?? null);
      updates.push(`reason_snomed_definition_status = $${params.length + 1}`);
      params.push(reasonConceptValue?.definitionStatus ?? null);

      if (
        reasonConceptValue?.term &&
        (payload.visit_reason === undefined || payload.visit_reason === null)
      ) {
        updates.push(`visit_reason = $${params.length + 1}::text`);
        params.push(reasonConceptValue.term);
      }
    }

    if ('symptom_concepts' in payload || 'symptomConcepts' in payload) {
      const symptomConceptList =
        payload.symptom_concepts === null || payload.symptomConcepts === null
          ? []
          : await this.normalizeConceptArray(
              tenantDb,
              payload.symptom_concepts ?? payload.symptomConcepts,
            );
      updates.push(`symptom_snomed_codes = $${params.length + 1}::jsonb`);
      params.push(JSON.stringify(symptomConceptList));
    }

    if ('diagnostic_concepts' in payload || 'diagnosticConcepts' in payload) {
      const diagnosticConceptList =
        payload.diagnostic_concepts === null || payload.diagnosticConcepts === null
          ? []
          : await this.normalizeConceptArray(
              tenantDb,
              payload.diagnostic_concepts ?? payload.diagnosticConcepts,
            );
      updates.push(`diagnostic_snomed_codes = $${params.length + 1}::jsonb`);
      params.push(JSON.stringify(diagnosticConceptList));
    }

    if (payload.care_status !== undefined) {
      const newStatus = String(payload.care_status);
      if (
        existing.payment_status === PAYMENT_STATUS.AWAITING_PAYMENT &&
        newStatus !== 'cancelled' &&
        newStatus !== 'awaiting_payment'
      ) {
        throw new BadRequestException('Payment must be confirmed before updating cardiology encounter status');
      }
      updates.push(`care_status = $${params.length + 1}::text`);
      params.push(newStatus);
    }

    if (payload.payment_status !== undefined) {
      updates.push(`payment_status = $${params.length + 1}::text`);
      params.push(payload.payment_status);
    }

    if (!updates.length) {
      throw new BadRequestException('No supported fields provided for update');
    }

    const setClause = `${updates.join(', ')}, updated_at = NOW()`;
    params.push(encounterId);

    const result = await tenantDb.query(
      `UPDATE cardiology_encounters SET ${setClause} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    if (!result.length) {
      throw new NotFoundException(`Cardiology encounter ${encounterId} not found`);
    }

    return result[0];
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const [totals] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_encounters,
        COUNT(*) FILTER (WHERE payment_status = 'awaiting_payment')::int AS awaiting_payment,
        COUNT(*) FILTER (WHERE care_status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE care_status = 'completed')::int AS completed
      FROM cardiology_encounters
    `,
    );

    const riskMix = await tenantDb.query(
      `
      SELECT
        COALESCE(risk_score, 'unknown') AS risk_score,
        COUNT(*)::int AS count
      FROM cardiology_encounters
      GROUP BY COALESCE(risk_score, 'unknown')
      ORDER BY count DESC
    `,
    );

    const [financials] = await tenantDb.query(
      `
      SELECT
        COALESCE(SUM(fee_amount), 0)::numeric AS total_fees,
        COALESCE(SUM(CASE WHEN payment_status = 'awaiting_payment' THEN fee_amount ELSE 0 END), 0)::numeric AS outstanding_fees
      FROM cardiology_encounters
    `,
    );

    const upcomingFollowUps = await tenantDb.query(
      `
      SELECT
        ce.id,
        ce.patient_id,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        ce.encounter_date,
        ce.follow_up_plan
      FROM cardiology_encounters ce
      INNER JOIN patients p ON p.id = ce.patient_id
      WHERE ce.follow_up_plan IS NOT NULL AND ce.follow_up_plan <> ''
      ORDER BY ce.encounter_date DESC
      LIMIT 5
    `,
    );

    const recentEncounters = await tenantDb.query(
      `
      SELECT
        ce.id,
        ce.encounter_date,
        ce.care_status,
        ce.payment_status,
        ce.risk_score,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number
      FROM cardiology_encounters ce
      INNER JOIN patients p ON p.id = ce.patient_id
      ORDER BY ce.encounter_date DESC
      LIMIT 10
    `,
    );

    const chiefComplaintMix = await tenantDb.query(
      `
      SELECT
        reason_snomed_code AS concept_id,
        COALESCE(reason_snomed_term, visit_reason) AS term,
        COUNT(*)::int AS count
      FROM cardiology_encounters
      WHERE reason_snomed_code IS NOT NULL
      GROUP BY reason_snomed_code, COALESCE(reason_snomed_term, visit_reason)
      ORDER BY count DESC
      LIMIT 10
      `,
    );

    const symptomMix = await tenantDb.query(
      `
      SELECT
        elem->>'conceptId' AS concept_id,
        elem->>'term' AS term,
        COUNT(*)::int AS count
      FROM cardiology_encounters
      CROSS JOIN LATERAL jsonb_array_elements(symptom_snomed_codes) AS elem
      WHERE symptom_snomed_codes IS NOT NULL
        AND elem->>'conceptId' IS NOT NULL
      GROUP BY elem->>'conceptId', elem->>'term'
      ORDER BY count DESC
      LIMIT 15
      `,
    );

    const diagnosticBacklog = await tenantDb.query(
      `
      SELECT
        elem->>'conceptId' AS concept_id,
        elem->>'term' AS term,
        COUNT(*)::int AS count
      FROM cardiology_encounters ce
      CROSS JOIN LATERAL jsonb_array_elements(diagnostic_snomed_codes) AS elem
      WHERE diagnostic_snomed_codes IS NOT NULL
        AND elem->>'conceptId' IS NOT NULL
        AND COALESCE(ce.care_status, '') <> 'completed'
      GROUP BY elem->>'conceptId', elem->>'term'
      ORDER BY count DESC
      LIMIT 15
      `,
    );

    return {
      totals: {
        totalEncounters: Number(totals?.total_encounters || 0),
        awaitingPayment: Number(totals?.awaiting_payment || 0),
        inProgress: Number(totals?.in_progress || 0),
        completed: Number(totals?.completed || 0),
      },
      financial: {
        totalFees: Number(financials?.total_fees || 0),
        outstandingFees: Number(financials?.outstanding_fees || 0),
      },
      riskMix,
      upcomingFollowUps,
      recentEncounters,
      chiefComplaintMix,
      symptomMix,
      diagnosticBacklog,
    };
  }

  // ── ECG ───────────────────────────────────────────────────────────────────

  async recordEcg(tenantDb: DataSource, data: Partial<EcgRecord>): Promise<EcgRecord & { cdss: any }> {
    const repo = tenantDb.getRepository(EcgRecord);
    const saved = await repo.save(repo.create({
      ...data,
      requiresUrgentReview: data.acsFeatures || data.requiresUrgentReview || false,
    }));

    const cdss = await this.cdssService.riskAssessment({
      patientId: data.patientId,
      diagnoses: [data.rhythm ?? 'ecg', data.acsFeatures ? 'ACS features' : 'routine ECG'],
      vitals: { heartRate: data.heartRateBpm },
      context: 'ecg_interpretation',
      specialty: 'cardiology',
      module: 'ecg',
    }, null as any, undefined).catch(() => null);

    return { ...saved, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async getEcgs(tenantDb: DataSource, patientId: string): Promise<EcgRecord[]> {
    return tenantDb.getRepository(EcgRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
    });
  }

  async getEcg(tenantDb: DataSource, id: string): Promise<EcgRecord> {
    const rec = await tenantDb.getRepository(EcgRecord).findOne({ where: { id } });
    if (!rec) throw new NotFoundException(`ECG record ${id} not found`);
    return rec;
  }

  async interpretEcg(tenantDb: DataSource, payload: Record<string, any>): Promise<any> {
    const local = localEcgInterpret(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      patientId: payload.patientId,
      symptoms: [payload.rhythm ?? 'arrhythmia', payload.stChanges ?? ''],
      vitals: { heartRate: payload.heartRateBpm, qtcMs: payload.qtcMs },
      specialty: 'cardiology',
      module: 'ecg_interpretation',
    }, null as any, undefined).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }
}

function localEcgInterpret(p: Record<string, any>): Record<string, any> {
  const alerts: string[] = [];
  let urgency = 'routine';

  if (p.acsFeatures) { alerts.push('ACS features — STEMI/NSTEMI protocol activation'); urgency = 'immediate'; }
  if (p.rhythm === 'vt') { alerts.push('Ventricular tachycardia — immediate senior review'); urgency = 'immediate'; }
  if (p.rhythm === 'af') { alerts.push('Atrial fibrillation — rate/rhythm control assessment needed'); }
  if (Number(p.qtcMs) > 500) { alerts.push(`QTc prolonged: ${p.qtcMs} ms — check medications causing QT prolongation`); }
  if (Number(p.qtcMs) > 440 && Number(p.qtcMs) <= 500) { alerts.push(`QTc borderline prolonged: ${p.qtcMs} ms`); }
  if (p.bundleBranchBlock === 'LBBB') { alerts.push('New LBBB — treat as STEMI equivalent if clinical context fits'); }
  if (p.lvHypertrophy) { alerts.push('LV hypertrophy — assess for hypertension, aortic stenosis'); }
  if (Number(p.heartRateBpm) > 150) { alerts.push(`Tachycardia: ${p.heartRateBpm} bpm`); if (urgency === 'routine') urgency = 'urgent'; }
  if (Number(p.heartRateBpm) < 40) { alerts.push(`Bradycardia: ${p.heartRateBpm} bpm — consider pacing`); if (urgency === 'routine') urgency = 'urgent'; }

  return { urgency, alerts, interpretation: alerts.length ? alerts.join('; ') : 'No acute features identified' };
}
