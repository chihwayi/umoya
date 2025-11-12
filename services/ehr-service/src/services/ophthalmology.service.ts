import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS } from '../constants/payment-status';

interface EncounterFilters {
  patientId?: string;
  ophthalmologistId?: string;
  fromDate?: string;
  toDate?: string;
  encounterType?: string;
}

@Injectable()
export class OphthalmologyService {
  private readonly logger = new Logger(OphthalmologyService.name);

  constructor(private readonly financeService: FinanceService) {}

  async listEncounters(tenantDb: DataSource, filters: EncounterFilters = {}) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.patientId) {
      conditions.push(`oe.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }

    if (filters.ophthalmologistId) {
      conditions.push(`oe.ophthalmologist_id = $${params.length + 1}`);
      params.push(filters.ophthalmologistId);
    }

    if (filters.encounterType) {
      conditions.push(`oe.encounter_type = $${params.length + 1}`);
      params.push(filters.encounterType);
    }

    if (filters.fromDate) {
      conditions.push(`oe.encounter_date >= $${params.length + 1}`);
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push(`oe.encounter_date <= $${params.length + 1}`);
      params.push(filters.toDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await tenantDb.query(
      `
      SELECT
        oe.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        doc.first_name || ' ' || doc.last_name AS ophthalmologist_name,
        COALESCE(fu.follow_up_count, 0) AS follow_up_count
      FROM ophthalmology_encounters oe
      INNER JOIN patients p ON p.id = oe.patient_id
      LEFT JOIN users doc ON doc.id = oe.ophthalmologist_id
      LEFT JOIN (
        SELECT related_encounter_id, COUNT(*) AS follow_up_count
        FROM ophthalmology_follow_ups
        GROUP BY related_encounter_id
      ) fu ON fu.related_encounter_id = oe.id
      ${whereClause}
      ORDER BY oe.encounter_date DESC
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
      ophthalmologist_id,
      chief_complaint,
      assessment,
      plan,
      fee_amount,
      feeAmount,
    } = payload;

    if (!patient_id || !encounter_date) {
      throw new BadRequestException('patient_id and encounter_date are required');
    }

    const rawFee = fee_amount ?? feeAmount ?? payload.estimated_fee ?? payload.estimatedFee ?? null;
    const parsedFee = rawFee !== null && rawFee !== undefined ? Number(rawFee) : Number.NaN;
    const defaultFee =
      process.env.DEFAULT_OPHTHALMOLOGY_FEE !== undefined
        ? Number(process.env.DEFAULT_OPHTHALMOLOGY_FEE)
        : 0;
    const feeValue = Number.isFinite(parsedFee) ? parsedFee : defaultFee;
    const feeAmountValue = Number.isFinite(feeValue) && feeValue > 0 ? feeValue : 0;

    let financeTransactionId: string | null = null;
    let paymentStatus: PAYMENT_STATUS = PAYMENT_STATUS.PAYMENT_CONFIRMED;

    if (feeAmountValue > 0) {
      const transaction = await this.financeService.createTransaction(
        tenantDb,
        {
          sourceModule: 'ophthalmology_encounters',
          patientId: patient_id,
          amount: feeAmountValue,
          currency: 'USD',
          notes: `Ophthalmology encounter (${encounter_type || 'exam'})`,
          payerType: 'self',
          lineItems: [
            {
              description: encounter_type ? `Encounter - ${encounter_type}` : 'Ophthalmology encounter',
              billingCode: 'OPHTH_ENC',
              unitPrice: feeAmountValue,
              quantity: 1,
            },
          ],
        },
        userId,
      );
      financeTransactionId = transaction.id;
      paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
    }

    const [encounter] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_encounters (
        patient_id,
        encounter_date,
        encounter_type,
        ophthalmologist_id,
        chief_complaint,
        assessment,
        plan,
        fee_amount,
        finance_transaction_id,
        payment_status,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,COALESCE($4,$5),$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *
      `,
      [
        patient_id,
        encounter_date,
        encounter_type,
        ophthalmologist_id,
        userId,
        chief_complaint,
        assessment,
        plan,
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

    this.logger.log(
      `Created ophthalmology encounter ${encounter.id} for patient ${patient_id} (${paymentStatus})`,
    );
    return encounter;
  }

  async updateEncounter(tenantDb: DataSource, encounterId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(encounterId);

    const result = await tenantDb.query(
      `UPDATE ophthalmology_encounters SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Ophthalmology encounter ${encounterId} not found`);
    }

    this.logger.log(`Updated ophthalmology encounter ${encounterId}`);
    return result[0];
  }

  async getEncounterDetail(tenantDb: DataSource, encounterId: string) {
    const [encounter] = await tenantDb.query(
      `
      SELECT
        oe.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        doc.first_name || ' ' || doc.last_name AS ophthalmologist_name
      FROM ophthalmology_encounters oe
      INNER JOIN patients p ON p.id = oe.patient_id
      LEFT JOIN users doc ON doc.id = oe.ophthalmologist_id
      WHERE oe.id = $1
      `,
      [encounterId],
    );

    if (!encounter) {
      throw new NotFoundException(`Ophthalmology encounter ${encounterId} not found`);
    }

    const visualAcuity = await tenantDb.query(
      `
      SELECT ova.*
      FROM ophthalmology_visual_acuity ova
      WHERE ova.encounter_id = $1
      ORDER BY created_at ASC
      `,
      [encounterId],
    );

    const refraction = await tenantDb.query(
      `
      SELECT orf.*
      FROM ophthalmology_refraction orf
      WHERE orf.encounter_id = $1
      ORDER BY created_at ASC
      `,
      [encounterId],
    );

    const slitLamp = await tenantDb.query(
      `
      SELECT osf.*
      FROM ophthalmology_slit_lamp_findings osf
      WHERE osf.encounter_id = $1
      ORDER BY created_at ASC
      `,
      [encounterId],
    );

    const octStudies = await tenantDb.query(
      `
      SELECT
        oos.*,
        istd.study_name,
        io.order_number
      FROM ophthalmology_oct_studies oos
      LEFT JOIN imaging_orders io ON io.id = oos.imaging_order_id
      LEFT JOIN imaging_study_types istd ON istd.id = io.study_type_id
      WHERE oos.encounter_id = $1
      ORDER BY oos.study_date DESC
      `,
      [encounterId],
    );

    const followUps = await tenantDb.query(
      `
      SELECT
        ofu.*,
        provider.first_name || ' ' || provider.last_name AS provider_name
      FROM ophthalmology_follow_ups ofu
      LEFT JOIN users provider ON provider.id = ofu.created_by
      WHERE ofu.related_encounter_id = $1
      ORDER BY ofu.scheduled_date ASC
      `,
      [encounterId],
    );

    return {
      encounter,
      visualAcuity,
      refraction,
      slitLamp,
      octStudies,
      followUps,
    };
  }

  async addVisualAcuityEntry(tenantDb: DataSource, encounterId: string, payload: any) {
    const { eye, distance_unaided, distance_aided, near_unaided, near_aided, pinhole, notes } = payload;

    if (!eye) {
      throw new BadRequestException('eye is required');
    }

    await this.ensureEncounterPaymentCleared(tenantDb, encounterId);

    const [entry] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_visual_acuity (
        encounter_id,
        eye,
        distance_unaided,
        distance_aided,
        near_unaided,
        near_aided,
        pinhole,
        notes,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *
      `,
      [encounterId, eye, distance_unaided, distance_aided, near_unaided, near_aided, pinhole, notes],
    );

    this.logger.log(`Recorded visual acuity ${entry.id} for encounter ${encounterId}`);
    return entry;
  }

  async addRefractionEntry(tenantDb: DataSource, encounterId: string, payload: any) {
    const { eye, sphere, cylinder, axis, add_power, corrected_va, notes } = payload;

    if (!eye) {
      throw new BadRequestException('eye is required');
    }

    await this.ensureEncounterPaymentCleared(tenantDb, encounterId);

    const [entry] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_refraction (
        encounter_id,
        eye,
        sphere,
        cylinder,
        axis,
        add_power,
        corrected_va,
        notes,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *
      `,
      [encounterId, eye, sphere, cylinder, axis, add_power, corrected_va, notes],
    );

    this.logger.log(`Recorded refraction ${entry.id} for encounter ${encounterId}`);
    return entry;
  }

  async addSlitLampFinding(tenantDb: DataSource, encounterId: string, payload: any) {
    const { structure, observation, severity } = payload;

    if (!structure || !observation) {
      throw new BadRequestException('structure and observation are required');
    }

    await this.ensureEncounterPaymentCleared(tenantDb, encounterId);

    const [entry] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_slit_lamp_findings (
        encounter_id,
        structure,
        observation,
        severity,
        created_at
      )
      VALUES ($1,$2,$3,$4,NOW())
      RETURNING *
      `,
      [encounterId, structure, observation, severity],
    );

    this.logger.log(`Recorded slit lamp finding ${entry.id} for encounter ${encounterId}`);
    return entry;
  }

  async addOctStudy(tenantDb: DataSource, encounterId: string, payload: any) {
    const { imaging_order_id, eye, study_date, image_reference, interpretation } = payload;

    if (!eye) {
      throw new BadRequestException('eye is required');
    }

    await this.ensureEncounterPaymentCleared(tenantDb, encounterId);

    const [entry] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_oct_studies (
        encounter_id,
        imaging_order_id,
        eye,
        study_date,
        image_reference,
        interpretation,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *
      `,
      [encounterId, imaging_order_id, eye, study_date, image_reference, interpretation],
    );

    this.logger.log(`Linked OCT study ${entry.id} to encounter ${encounterId}`);
    return entry;
  }

  async scheduleFollowUp(tenantDb: DataSource, payload: any, userId?: string) {
    const { patient_id, scheduled_date, reason, priority, status, related_encounter_id } = payload;

    if (!patient_id || !scheduled_date) {
      throw new BadRequestException('patient_id and scheduled_date are required');
    }

    if (related_encounter_id) {
      await this.ensureEncounterPaymentCleared(tenantDb, related_encounter_id);
    }

    const [followUp] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_follow_ups (
        patient_id,
        scheduled_date,
        reason,
        priority,
        status,
        related_encounter_id,
        reminders_sent,
        created_at,
        updated_at,
        created_by
      )
      VALUES ($1,$2,$3,COALESCE($4,'routine'),COALESCE($5,'scheduled'),$6,'[]'::jsonb,NOW(),NOW(),$7)
      RETURNING *
      `,
      [patient_id, scheduled_date, reason, priority, status, related_encounter_id, userId],
    );

    this.logger.log(`Scheduled follow-up ${followUp.id} for patient ${patient_id}`);
    return followUp;
  }

  async updateFollowUp(tenantDb: DataSource, followUpId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(followUpId);

    const result = await tenantDb.query(
      `UPDATE ophthalmology_follow_ups SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Ophthalmology follow-up ${followUpId} not found`);
    }

    this.logger.log(`Updated follow-up ${followUpId}`);
    return result[0];
  }

  async listFollowUps(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        ofu.*,
        enc.encounter_date,
        enc.encounter_type
      FROM ophthalmology_follow_ups ofu
      LEFT JOIN ophthalmology_encounters enc ON enc.id = ofu.related_encounter_id
      WHERE ofu.patient_id = $1
      ORDER BY ofu.scheduled_date ASC
      `,
      [patientId],
    );

    return { followUps: rows, total: rows.length };
  }

  async recordProcedure(tenantDb: DataSource, payload: any) {
    const { patient_id, procedure_name, procedure_date, eye, outcome, complications, surgeon_id, encounter_id } = payload;

    if (!patient_id || !procedure_name || !procedure_date) {
      throw new BadRequestException('patient_id, procedure_name and procedure_date are required');
    }

    if (encounter_id) {
      await this.ensureEncounterPaymentCleared(tenantDb, encounter_id);
    }

    const [procedure] = await tenantDb.query(
      `
      INSERT INTO ophthalmology_procedures (
        patient_id,
        encounter_id,
        procedure_name,
        procedure_date,
        eye,
        outcome,
        complications,
        surgeon_id,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
      RETURNING *
      `,
      [patient_id, encounter_id, procedure_name, procedure_date, eye, outcome, complications, surgeon_id],
    );

    this.logger.log(`Recorded ophthalmology procedure ${procedure.id} for patient ${patient_id}`);
    return procedure;
  }

  async listProcedures(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        op.*,
        surg.first_name || ' ' || surg.last_name AS surgeon_name
      FROM ophthalmology_procedures op
      LEFT JOIN users surg ON surg.id = op.surgeon_id
      WHERE op.patient_id = $1
      ORDER BY op.procedure_date DESC
      `,
      [patientId],
    );

    return { procedures: rows, total: rows.length };
  }

  private async ensureEncounterPaymentCleared(tenantDb: DataSource, encounterId: string) {
    const [encounter] = await tenantDb.query(
      `
      SELECT payment_status
      FROM ophthalmology_encounters
      WHERE id = $1
      `,
      [encounterId],
    );

    if (!encounter) {
      throw new NotFoundException(`Ophthalmology encounter ${encounterId} not found`);
    }

    if (encounter.payment_status === PAYMENT_STATUS.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Payment confirmation required before documenting findings for this encounter',
      );
    }
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const [encounterTotals] = await tenantDb.query(
      `
      SELECT
        COUNT(*) AS total_encounters,
        COUNT(*) FILTER (WHERE encounter_type = 'comprehensive_exam') AS comprehensive_exams,
        COUNT(*) FILTER (WHERE encounter_type = 'follow_up') AS follow_ups,
        COUNT(*) FILTER (WHERE encounter_date >= NOW() - INTERVAL '30 days') AS past_30_day_encounters
      FROM ophthalmology_encounters
      `,
    );

    const upcomingFollowUps = await tenantDb.query(
      `
      SELECT
        ofu.*,
        p.first_name || ' ' || p.last_name AS patient_name
      FROM ophthalmology_follow_ups ofu
      INNER JOIN patients p ON p.id = ofu.patient_id
      WHERE ofu.scheduled_date >= NOW()
      ORDER BY ofu.scheduled_date ASC
      LIMIT 25
      `,
    );

    const procedureSummary = await tenantDb.query(
      `
      SELECT
        procedure_name,
        eye,
        COUNT(*) AS count
      FROM ophthalmology_procedures
      WHERE procedure_date >= NOW() - INTERVAL '180 days'
      GROUP BY procedure_name, eye
      ORDER BY count DESC
      LIMIT 20
      `,
    );

    const visualAcuityTrend = await tenantDb.query(
      `
      SELECT
        DATE_TRUNC('month', oe.encounter_date) AS month_bucket,
        COUNT(ova.id) FILTER (WHERE ova.eye = 'OD') AS od_entries,
        COUNT(ova.id) FILTER (WHERE ova.eye = 'OS') AS os_entries,
        COUNT(ova.id) FILTER (WHERE ova.eye = 'OU') AS ou_entries
      FROM ophthalmology_encounters oe
      LEFT JOIN ophthalmology_visual_acuity ova ON ova.encounter_id = oe.id
      WHERE oe.encounter_date >= NOW() - INTERVAL '12 months'
      GROUP BY month_bucket
      ORDER BY month_bucket ASC
      `,
    );

    const [financeSummary] = await tenantDb.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'awaiting_payment') AS awaiting_payment_encounters,
        COUNT(*) FILTER (WHERE payment_status = 'payment_confirmed') AS cleared_encounters,
        COUNT(*) AS total_encounters
      FROM ophthalmology_encounters
      `,
    );

    return {
      encounterTotals,
      upcomingFollowUps,
      procedureSummary,
      visualAcuityTrend,
      financeSummary,
    };
  }
}

