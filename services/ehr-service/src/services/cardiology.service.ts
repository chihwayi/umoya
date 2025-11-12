import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS } from '../constants/payment-status';

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

@Injectable()
export class CardiologyService {
  private readonly logger = new Logger(CardiologyService.name);

  constructor(private readonly financeService: FinanceService) {}

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
    let paymentStatus: PAYMENT_STATUS = PAYMENT_STATUS.PAYMENT_CONFIRMED;
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
    const normalizedCardiologistId = typeof cardiologist_id === 'string' && cardiologist_id.trim().length > 0 ? cardiologist_id : null;
    const normalizedUserId = typeof userId === 'string' && userId.trim().length > 0 ? userId : null;
    const cardiologistIdValue = normalizedCardiologistId ?? normalizedUserId ?? null;

    const [encounter] = await tenantDb.query(
      `
      INSERT INTO cardiology_encounters (
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
        care_status,
        fee_amount,
        finance_transaction_id,
        payment_status,
        created_at,
        updated_at
      )
      VALUES ($1::uuid,$2::timestamptz,$3::text,$4::uuid,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::text,$10::text,$11::text,$12::text,$13::numeric,$14::uuid,$15::text,NOW(),NOW())
      RETURNING *
      `,
      [
        patient_id,
        encounter_date,
        encounter_type,
        cardiologistIdValue,
        visit_reason || null,
        presenting_symptoms || null,
        hemodynamicsJson,
        diagnosticTestsJson,
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
    };
  }
}
