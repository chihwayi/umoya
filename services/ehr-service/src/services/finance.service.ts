import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFinanceTransactionDto, FinanceLineItemDto, RecordPaymentDto } from '../dto/finance.dto';
import { PAYMENT_STATUS, PaymentStatus } from '../constants/payment-status';
import { FinancialQuoteAssessment } from '../entities/financial-quote-assessment.entity';
import { NotificationCenterService } from './notification-center.service';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Optional() private readonly notificationCenterService?: NotificationCenterService,
  ) {}

  private mapFinanceStatusToPaymentStatus(financeStatus: string): PaymentStatus {
    if (financeStatus === 'paid') {
      return PAYMENT_STATUS.PAYMENT_CONFIRMED;
    }
    if (financeStatus === 'cancelled') {
      return PAYMENT_STATUS.CANCELLED;
    }
    return PAYMENT_STATUS.AWAITING_PAYMENT;
  }

  private toNumber(value: any, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
  }

  private parseJsonObject<T = Record<string, any>>(value: any, fallback: T): T {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'object') {
      return value as T;
    }
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return fallback;
    }
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const [totals] = await tenantDb.query(`
      SELECT 
        COALESCE(SUM(amount),0) AS total_amount,
        COALESCE(SUM(balance),0) AS total_balance,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN balance ELSE 0 END),0) AS outstanding_balance
      FROM financial_transactions
    `);

    const [todayReceipts] = await tenantDb.query(`
      SELECT COALESCE(SUM(amount),0) AS today_receipts
      FROM financial_payments
      WHERE status = 'completed' AND DATE(received_at) = CURRENT_DATE
    `);

    const moduleBreakdown = await tenantDb.query(`
      SELECT source_module,
             COUNT(*) AS count,
             COALESCE(SUM(amount),0) AS total_amount,
             COALESCE(SUM(balance),0) AS outstanding_amount
      FROM financial_transactions
      GROUP BY source_module
      ORDER BY total_amount DESC
    `);

    const payerBreakdown = await tenantDb.query(`
      SELECT payer_type,
             COUNT(*) AS count,
             COALESCE(SUM(amount),0) AS total_amount,
             COALESCE(SUM(balance),0) AS outstanding_amount
      FROM financial_transactions
      GROUP BY payer_type
      ORDER BY total_amount DESC
    `);

    const statusBreakdown = await tenantDb.query(`
      SELECT payment_status,
             COUNT(*) AS count,
             COALESCE(SUM(balance),0) AS outstanding_amount
      FROM financial_transactions
      GROUP BY payment_status
    `);

    const [pendingClaims] = await tenantDb.query(`
      SELECT 
        COUNT(*) AS claim_count,
        COALESCE(SUM(amount_submitted),0) AS total_submitted,
        COALESCE(SUM(amount_approved),0) AS total_approved
      FROM financial_claims
      WHERE status IN ('pending','submitted')
    `);

    const recentPayments = await tenantDb.query(`
      SELECT fp.*, ft.source_module, ft.source_reference_id, p.first_name, p.last_name, p.patient_number
      FROM financial_payments fp
      LEFT JOIN financial_transactions ft ON ft.id = fp.transaction_id
      LEFT JOIN patients p ON p.id = ft.patient_id
      ORDER BY fp.received_at DESC
      LIMIT 10
    `);

    const agingBuckets = await tenantDb.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND (due_date IS NULL OR due_date >= CURRENT_DATE) THEN balance ELSE 0 END),0) AS current,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days' THEN balance ELSE 0 END),0) AS bucket_0_30,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days' THEN balance ELSE 0 END),0) AS bucket_31_60,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days' THEN balance ELSE 0 END),0) AS bucket_61_90,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '90 days' THEN balance ELSE 0 END),0) AS bucket_over_90
      FROM financial_transactions
    `);

    return {
      totals: {
        totalAmount: Number(totals?.total_amount || 0),
        totalBalance: Number(totals?.total_balance || 0),
        outstandingBalance: Number(totals?.outstanding_balance || 0),
        todayReceipts: Number(todayReceipts?.today_receipts || 0),
      },
      moduleBreakdown,
      payerBreakdown,
      statusBreakdown,
      pendingClaims: {
        count: Number(pendingClaims?.claim_count || 0),
        totalSubmitted: Number(pendingClaims?.total_submitted || 0),
        totalApproved: Number(pendingClaims?.total_approved || 0),
      },
      aging: agingBuckets?.[0] || {
        current: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_over_90: 0,
      },
      recentPayments,
    };
  }

  async createTransaction(
    tenantDb: DataSource,
    payload: CreateFinanceTransactionDto,
    userId?: string,
  ) {
    const amount = Number(payload.amount || 0);
    if (amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than zero');
    }

    const paymentStatus =
      payload.paymentStatus ||
      (amount > 0 ? PAYMENT_STATUS.AWAITING_PAYMENT : PAYMENT_STATUS.PAYMENT_CONFIRMED);
    const financeStatus = paymentStatus === PAYMENT_STATUS.PAYMENT_CONFIRMED ? 'paid' : 'pending';
    const initialBalance = financeStatus === 'paid' ? 0 : amount;

    const [transaction] = await tenantDb.query(
      `
      INSERT INTO financial_transactions (
        patient_id,
        payer_type,
        source_module,
        source_reference_id,
        amount,
        balance,
        currency,
        payment_status,
        due_date,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
      [
        payload.patientId || null,
        payload.payerType || 'self',
        payload.sourceModule,
        payload.sourceReferenceId || null,
        amount,
        initialBalance,
        payload.currency || 'USD',
        financeStatus,
        payload.dueDate ? new Date(payload.dueDate) : null,
        payload.notes || null,
        userId ?? payload.patientId ?? 'system',
      ],
    );

    if (payload.lineItems?.length) {
      await this.insertLineItems(tenantDb, transaction.id, payload.lineItems);
    } else {
      await tenantDb.query(
        `
        INSERT INTO financial_line_items (
          transaction_id,
          description,
          billing_code,
          unit_price,
          quantity,
          discount,
          tax,
          total
        )
        VALUES ($1, $2, $3, $4, 1, 0, 0, $4)
      `,
        [
          transaction.id,
          payload.notes || 'Service fee',
          payload.sourceModule ? payload.sourceModule.toUpperCase() : null,
          amount,
        ],
      );
    }

    return transaction;
  }

  async getTransactionStatus(tenantDb: DataSource, transactionId: string) {
    const [transaction] = await tenantDb.query(
      `SELECT payment_status, balance, amount FROM financial_transactions WHERE id = $1`,
      [transactionId],
    );

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return {
      paymentStatus: transaction.payment_status,
      balance: Number(transaction.balance || 0),
      amount: Number(transaction.amount || 0),
      modulePaymentStatus: this.mapFinanceStatusToPaymentStatus(transaction.payment_status),
    };
  }

  async listTransactions(
    tenantDb: DataSource,
    filters: {
      status?: string;
      module?: string;
      payerType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`ft.payment_status = $${params.length}`);
    }

    if (filters.module) {
      params.push(filters.module);
      conditions.push(`ft.source_module = $${params.length}`);
    }

    if (filters.payerType) {
      params.push(filters.payerType);
      conditions.push(`ft.payer_type = $${params.length}`);
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`ft.created_at >= $${params.length}`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`ft.created_at <= $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      conditions.push(`(
        LOWER(p.first_name) LIKE $${params.length} OR 
        LOWER(p.last_name) LIKE $${params.length} OR
        LOWER(p.patient_number) LIKE $${params.length}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;

    const transactions = await tenantDb.query(
      `
      SELECT ft.*, 
             p.first_name,
             p.last_name,
             p.patient_number,
             p.phone,
             jsonb_build_object(
               'count', COALESCE(count_claims.count, 0),
               'pending', COALESCE(count_claims.pending, 0)
             ) AS claims_summary
      FROM financial_transactions ft
      LEFT JOIN patients p ON p.id = ft.patient_id
      LEFT JOIN (
        SELECT transaction_id,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE status IN ('pending','submitted')) AS pending
        FROM financial_claims
        GROUP BY transaction_id
      ) count_claims ON count_claims.transaction_id = ft.id
      ${whereClause}
      ORDER BY ft.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
      params,
    );

    const [totalResult] = await tenantDb.query(
      `
      SELECT COUNT(*) AS total
      FROM financial_transactions ft
      LEFT JOIN patients p ON p.id = ft.patient_id
      ${whereClause}
    `,
      params,
    );

    return {
      transactions,
      total: Number(totalResult?.total || 0),
    };
  }

  async getTransactionDetail(tenantDb: DataSource, transactionId: string) {
    const [transaction] = await tenantDb.query(
      `
      SELECT ft.*, p.first_name, p.last_name, p.patient_number, p.phone
      FROM financial_transactions ft
      LEFT JOIN patients p ON p.id = ft.patient_id
      WHERE ft.id = $1
    `,
      [transactionId],
    );

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const lineItems = await tenantDb.query(
      `SELECT * FROM financial_line_items WHERE transaction_id = $1 ORDER BY created_at`,
      [transactionId],
    );

    const payments = await tenantDb.query(
      `SELECT * FROM financial_payments WHERE transaction_id = $1 ORDER BY received_at DESC`,
      [transactionId],
    );

    const claims = await tenantDb.query(
      `SELECT * FROM financial_claims WHERE transaction_id = $1 ORDER BY created_at DESC`,
      [transactionId],
    );

    const reconciliationLogs = await tenantDb.query(
      `SELECT * FROM financial_reconciliation_logs WHERE transaction_id = $1 ORDER BY reconciliation_date DESC`,
      [transactionId],
    );

    return {
      transaction,
      lineItems,
      payments,
      claims,
      reconciliationLogs,
    };
  }

  async generatePatientQuote(tenantDb: DataSource, transactionId: string) {
    const detail = await this.getTransactionDetail(tenantDb, transactionId);
    const transaction = detail.transaction;
    const lineItems = Array.isArray(detail.lineItems) ? detail.lineItems : [];
    const totalCharge = lineItems.length
      ? Number(
          lineItems
            .reduce((sum: number, item: any) => sum + Number(item.total || 0), 0)
            .toFixed(2),
        )
      : this.toNumber(transaction.amount || 0);

    const [bill] = transaction?.source_reference_id
      ? await tenantDb.query(
          `
            SELECT id, appointment_id
            FROM billing
            WHERE id::text = $1 OR appointment_id::text = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [transaction.source_reference_id],
        )
      : [];

    const billId = bill?.id || (transaction.source_module === 'billing' ? transaction.source_reference_id : null);
    const appointmentId =
      bill?.appointment_id ||
      (transaction.source_module === 'appointments' ? transaction.source_reference_id : null);

    const [latestClaim] = billId
      ? await tenantDb.query(
          `
            SELECT id, billing_id, patient_id, claim_amount, medical_aid_name, member_number, created_at
            FROM medical_aid_claims
            WHERE billing_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [billId],
        )
      : [];

    const [latestVerification] = transaction.patient_id
      ? await tenantDb.query(
          `
            SELECT *
            FROM insurance_verifications
            WHERE patient_id = $1
              AND ($2::uuid IS NULL OR appointment_id = $2::uuid OR appointment_id IS NULL)
            ORDER BY verified_at DESC NULLS LAST, created_at DESC
            LIMIT 1
          `,
          [transaction.patient_id, appointmentId || null],
        )
      : [];

    let latestClearance: any = null;
    if (latestClaim?.id) {
      [latestClearance] = await tenantDb.query(
        `
          SELECT *
          FROM financial_clearance_assessments
          WHERE claim_id = $1::uuid
          ORDER BY assessed_at DESC, created_at DESC
          LIMIT 1
        `,
        [latestClaim.id],
      );
    } else if (billId) {
      [latestClearance] = await tenantDb.query(
        `
          SELECT *
          FROM financial_clearance_assessments
          WHERE bill_id = $1::uuid
          ORDER BY assessed_at DESC, created_at DESC
          LIMIT 1
        `,
        [billId],
      );
    }

    const coverageDetails = this.parseJsonObject<Record<string, any>>(
      latestVerification?.coverage_details,
      {},
    );
    const verificationStatus = String(
      latestVerification?.verification_status ||
        latestClearance?.eligibility_status ||
        transaction.payer_type ||
        '',
    )
      .trim()
      .toLowerCase();

    const explicitCoveragePercent = Number(
      coverageDetails.coveredPercentage ??
        coverageDetails.coveragePercent ??
        coverageDetails.payerCoveragePercent ??
        coverageDetails.covered_percent ??
        NaN,
    );
    const coveragePercent = Number.isFinite(explicitCoveragePercent)
      ? explicitCoveragePercent
      : verificationStatus.startsWith('verified')
        ? 80
        : transaction.payer_type === 'medical_aid'
          ? 60
          : 0;

    const copayAmount =
      latestClearance?.assessment_data?.copayAmount != null
        ? this.toNumber(latestClearance.assessment_data.copayAmount)
        : latestVerification?.copay_amount != null
          ? this.toNumber(latestVerification.copay_amount)
          : this.toNumber(coverageDetails.copayAmount ?? coverageDetails.copay ?? 0);
    const deductibleRemaining =
      latestVerification?.deductible_remaining != null
        ? this.toNumber(latestVerification.deductible_remaining)
        : this.toNumber(coverageDetails.deductibleRemaining ?? 0);
    const deductibleApplied =
      transaction.payer_type === 'medical_aid' ? Math.min(totalCharge, deductibleRemaining) : 0;

    const fallbackPayerAmount =
      transaction.payer_type === 'self'
        ? 0
        : Math.max(totalCharge - copayAmount - deductibleApplied, 0) * (coveragePercent / 100);
    const estimatedPayerAmount =
      latestClearance?.payer_estimated_amount != null
        ? this.toNumber(latestClearance.payer_estimated_amount)
        : this.toNumber(fallbackPayerAmount);
    const estimatedPatientResponsibility =
      latestClearance?.estimated_responsibility != null
        ? this.toNumber(latestClearance.estimated_responsibility)
        : this.toNumber(
            transaction.payer_type === 'self'
              ? totalCharge
              : Math.max(totalCharge - estimatedPayerAmount, 0),
          );

    const blockers = Array.isArray(latestClearance?.blockers)
      ? latestClearance.blockers
      : this.parseJsonObject<Array<Record<string, any>>>(latestClearance?.blockers, []);
    if (transaction.payer_type === 'medical_aid' && !verificationStatus.startsWith('verified')) {
      blockers.push({
        code: 'insurance_verification_pending',
        message: 'Insurance verification is not yet confirmed for this transaction.',
      });
    }

    const quoteStatus =
      transaction.payer_type === 'self'
        ? 'self_pay'
        : verificationStatus.startsWith('verified')
          ? 'verified_quote'
          : blockers.length > 0
            ? 'blocked_quote'
            : 'estimate_only';
    const quoteConfidence =
      quoteStatus === 'verified_quote' ? 'high' : quoteStatus === 'blocked_quote' ? 'low' : 'medium';
    const recommendedNextStep =
      latestClearance?.recommended_next_step ||
      (quoteStatus === 'self_pay'
        ? 'Collect patient payment or offer instalment options before service.'
        : quoteStatus === 'verified_quote'
          ? 'Proceed with service using the verified payer estimate and collect the expected patient portion.'
          : 'Verify coverage and confirm any deductible/copay obligations before service.');

    const repository = tenantDb.getRepository(FinancialQuoteAssessment);
    const saved = await repository.save(
      repository.create({
        transactionId,
        patientId: transaction.patient_id || null,
        billId: billId || null,
        appointmentId: appointmentId || null,
        payerType: transaction.payer_type || 'self',
        quoteStatus,
        totalCharge,
        estimatedPayerAmount,
        estimatedPatientResponsibility,
        copayAmount,
        deductibleRemaining,
        quoteConfidence,
        blockers,
        recommendedNextStep,
        quoteData: {
          transactionAmount: this.toNumber(transaction.amount || 0),
          coveragePercent,
          deductibleApplied,
          lineItems: lineItems.map((item: any) => ({
            description: item.description,
            billingCode: item.billing_code,
            total: this.toNumber(item.total || 0),
          })),
          sourceSignals: {
            insuranceVerificationId: latestVerification?.id || null,
            financialClearanceAssessmentId: latestClearance?.id || null,
            claimId: latestClaim?.id || null,
          },
          payerContext: {
            medicalAidName: latestClaim?.medical_aid_name || latestVerification?.payer_name || null,
            memberNumber: latestClaim?.member_number || latestVerification?.policy_number || null,
          },
        },
      }),
    );

    return {
      id: saved.id,
      transactionId,
      patientId: saved.patientId,
      billId: saved.billId,
      appointmentId: saved.appointmentId,
      payerType: saved.payerType,
      quoteStatus: saved.quoteStatus,
      totalCharge: this.toNumber(saved.totalCharge),
      estimatedPayerAmount: this.toNumber(saved.estimatedPayerAmount),
      estimatedPatientResponsibility: this.toNumber(saved.estimatedPatientResponsibility),
      copayAmount: this.toNumber(saved.copayAmount),
      deductibleRemaining: this.toNumber(saved.deductibleRemaining),
      quoteConfidence: saved.quoteConfidence,
      blockers: saved.blockers,
      recommendedNextStep: saved.recommendedNextStep,
      quotedAt: saved.quotedAt,
      quoteData: saved.quoteData,
    };
  }

  async recordPayment(tenantDb: DataSource, transactionId: string, payload: RecordPaymentDto, userId: string) {
    if (!payload.amount || payload.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    await tenantDb.query('BEGIN');

    try {
      const [transaction] = await tenantDb.query(
        `SELECT id, amount, balance, payment_status, source_module, source_reference_id, patient_id FROM financial_transactions WHERE id = $1 FOR UPDATE`,
        [transactionId],
      );

      if (!transaction) {
        throw new NotFoundException(`Transaction ${transactionId} not found`);
      }

      const currentBalance = Number(transaction.balance || 0);
      const paymentAmount = Number(payload.amount);
      const newBalance = Math.max(currentBalance - paymentAmount, 0);
      const financeStatus = newBalance <= 0.01 ? 'paid' : 'partially_paid';

      const [payment] = await tenantDb.query(
        `
        INSERT INTO financial_payments (
          transaction_id,
          payment_method,
          payment_reference,
          gateway_reference,
          amount,
          status,
          processed_by,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)
        RETURNING *
      `,
        [
          transactionId,
          payload.paymentMethod,
          payload.paymentReference || null,
          payload.gatewayReference || null,
          paymentAmount,
          userId || null,
          JSON.stringify(payload.note ? { note: payload.note } : {}),
        ],
      );

      await tenantDb.query(
        `
        UPDATE financial_transactions
        SET balance = $1,
            payment_status = $2,
            updated_at = NOW()
        WHERE id = $3
      `,
        [newBalance, financeStatus, transactionId],
      );

      await this.updateLinkedModulePaymentStatus(
        tenantDb,
        transaction.source_module,
        transaction.source_reference_id,
        financeStatus,
      );

      await tenantDb.query('COMMIT');

      // S221: payment_received notification — config-gated, best-effort, never
      // affects the recorded payment.
      if (this.notificationCenterService && transaction.patient_id) {
        try {
          const [patient] = await tenantDb.query(
            `SELECT phone, email, first_name FROM patients WHERE id = $1 LIMIT 1`,
            [transaction.patient_id],
          );
          if (patient?.phone || patient?.email) {
            const reference = payload.paymentReference || String(transactionId).slice(0, 8).toUpperCase();
            const balanceNote = newBalance > 0.01 ? ` Outstanding balance: $${newBalance.toFixed(2)}.` : '';
            await this.notificationCenterService.notifyTrigger(tenantDb, 'payment_received', {
              recipientSms: patient.phone || undefined,
              recipientEmail: patient.email || undefined,
              patientId: transaction.patient_id,
              subject: 'Payment Received',
              message: `Payment of $${paymentAmount.toFixed(2)} received. Ref: ${reference}.${balanceNote} Thank you.`,
            });
          }
        } catch (notifyError: any) {
          this.logger.warn(`payment_received notification failed: ${notifyError?.message}`);
        }
      }

      return {
        payment,
        updatedTransaction: {
          balance: newBalance,
          paymentStatus: financeStatus,
        },
      };
    } catch (error) {
      await tenantDb.query('ROLLBACK');
      throw error;
    }
  }

  private async insertLineItems(
    tenantDb: DataSource,
    transactionId: string,
    lineItems: FinanceLineItemDto[],
  ) {
    for (const item of lineItems) {
      const total =
        (Number(item.unitPrice || 0) - Number(item.discount || 0)) * Number(item.quantity || 1) +
        Number(item.tax || 0);
      await tenantDb.query(
        `
        INSERT INTO financial_line_items (
          transaction_id,
          description,
          billing_code,
          unit_price,
          quantity,
          discount,
          tax,
          total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          transactionId,
          item.description,
          item.billingCode || null,
          Number(item.unitPrice || 0),
          Number(item.quantity || 1),
          Number(item.discount || 0),
          Number(item.tax || 0),
          total,
        ],
      );
    }
  }

  private async updateLinkedModulePaymentStatus(
    tenantDb: DataSource,
    sourceModule: string | null,
    sourceReferenceId: string | null,
    financeStatus: string,
  ) {
    if (!sourceModule || !sourceReferenceId) {
      return;
    }

    const paymentStatus = this.mapFinanceStatusToPaymentStatus(financeStatus);

    switch (sourceModule) {
      case 'appointments':
        await tenantDb.query(
          `
          UPDATE appointments
          SET payment_status = $1::text,
              status = CASE
                          WHEN $1::text = $2::text AND status = 'awaiting_payment' THEN 'scheduled'
                          ELSE status
                       END,
              updated_at = NOW()
          WHERE id = $3::uuid
        `,
          [paymentStatus, PAYMENT_STATUS.PAYMENT_CONFIRMED, sourceReferenceId],
        );
        break;
      case 'imaging_orders':
        await tenantDb.query(
          `
          UPDATE imaging_orders
          SET payment_status = $1::text,
              order_status = CASE
                               WHEN $1::text = $2::text AND order_status = 'awaiting_payment' THEN 'ordered'
                               ELSE order_status
                             END,
              updated_at = NOW()
          WHERE id = $3::uuid
        `,
          [paymentStatus, PAYMENT_STATUS.PAYMENT_CONFIRMED, sourceReferenceId],
        );
        break;
      case 'lab_orders':
        await tenantDb.query(
          `
          UPDATE lab_orders
          SET payment_status = $1::text,
              status = CASE
                         WHEN $1::text = $2::text AND status = 'awaiting_payment' THEN 'ordered'
                         ELSE status
                       END,
              updated_at = NOW()
          WHERE id = $3::uuid
        `,
          [paymentStatus, PAYMENT_STATUS.PAYMENT_CONFIRMED, sourceReferenceId],
        );
        break;
      case 'oncology_infusion_sessions':
        await tenantDb.query(
          `
          UPDATE oncology_infusion_sessions
          SET payment_status = $1::text,
              status = CASE
                         WHEN $1::text = $2::text AND status = 'awaiting_payment' THEN 'scheduled'
                         ELSE status
                       END,
              updated_at = NOW()
          WHERE id = $3::uuid
        `,
          [paymentStatus, PAYMENT_STATUS.PAYMENT_CONFIRMED, sourceReferenceId],
        );
        break;
      case 'ophthalmology_encounters':
        await tenantDb.query(
          `
          UPDATE ophthalmology_encounters
          SET payment_status = $1::text,
              updated_at = NOW()
          WHERE id = $2::uuid
        `,
          [paymentStatus, sourceReferenceId],
        );
        break;
      case 'cardiology_encounters':
        await tenantDb.query(
          `
          UPDATE cardiology_encounters
          SET payment_status = $1::text,
              care_status = CASE
                              WHEN $1::text = $2::text AND care_status = 'awaiting_payment' THEN 'scheduled'
                              ELSE care_status
                            END,
              updated_at = NOW()
          WHERE id = $3::uuid
        `,
          [paymentStatus, PAYMENT_STATUS.PAYMENT_CONFIRMED, sourceReferenceId],
        );
        break;
      default:
        break;
    }
  }

  async getFinancialReports(
    tenantDb: DataSource,
    filters: {
      reportType: 'revenue' | 'profit_loss' | 'cash_flow' | 'aging';
      dateFrom?: string;
      dateTo?: string;
      groupBy?: 'day' | 'week' | 'month' | 'year';
    },
  ) {
    const { reportType, dateFrom, dateTo, groupBy = 'month' } = filters;

    switch (reportType) {
      case 'revenue':
        return this.getRevenueReport(tenantDb, dateFrom, dateTo, groupBy);
      case 'profit_loss':
        return this.getProfitLossReport(tenantDb, dateFrom, dateTo);
      case 'cash_flow':
        return this.getCashFlowReport(tenantDb, dateFrom, dateTo, groupBy);
      case 'aging':
        return this.getAgingReport(tenantDb);
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async getRevenueReport(
    tenantDb: DataSource,
    dateFrom?: string,
    dateTo?: string,
    groupBy: string = 'month',
  ) {
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      dateFilter += ` AND fp.received_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      dateFilter += ` AND fp.received_at <= $${params.length}`;
    }

    let groupByClause = '';
    switch (groupBy) {
      case 'day':
        groupByClause = "DATE_TRUNC('day', fp.received_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', fp.received_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', fp.received_at)";
        break;
      case 'year':
        groupByClause = "DATE_TRUNC('year', fp.received_at)";
        break;
    }

    const revenue = await tenantDb.query(
      `
      SELECT 
        ${groupByClause} AS period,
        COALESCE(SUM(fp.amount), 0) AS total_revenue,
        COUNT(DISTINCT fp.transaction_id) AS transaction_count,
        COUNT(DISTINCT ft.patient_id) AS patient_count
      FROM financial_payments fp
      INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
      WHERE fp.status = 'completed' ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `,
      params,
    );

    const byModule = await tenantDb.query(
      `
      SELECT 
        ft.source_module,
        COALESCE(SUM(fp.amount), 0) AS total_revenue,
        COUNT(DISTINCT fp.transaction_id) AS transaction_count
      FROM financial_payments fp
      INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
      WHERE fp.status = 'completed' ${dateFilter}
      GROUP BY ft.source_module
      ORDER BY total_revenue DESC
    `,
      params,
    );

    const byPayerType = await tenantDb.query(
      `
      SELECT 
        ft.payer_type,
        COALESCE(SUM(fp.amount), 0) AS total_revenue,
        COUNT(DISTINCT fp.transaction_id) AS transaction_count
      FROM financial_payments fp
      INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
      WHERE fp.status = 'completed' ${dateFilter}
      GROUP BY ft.payer_type
      ORDER BY total_revenue DESC
    `,
      params,
    );

    return {
      reportType: 'revenue',
      period: { dateFrom, dateTo, groupBy },
      summary: {
        totalRevenue: revenue.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0),
        totalTransactions: revenue.reduce((sum, r) => sum + Number(r.transaction_count || 0), 0),
        totalPatients: revenue.reduce((sum, r) => sum + Number(r.patient_count || 0), 0),
      },
      byPeriod: revenue,
      byModule,
      byPayerType,
    };
  }

  private async getProfitLossReport(tenantDb: DataSource, dateFrom?: string, dateTo?: string) {
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      dateFilter += ` AND fp.received_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      dateFilter += ` AND fp.received_at <= $${params.length}`;
    }

    const revenue = await tenantDb.query(
      `
      SELECT COALESCE(SUM(fp.amount), 0) AS total_revenue
      FROM financial_payments fp
      WHERE fp.status = 'completed' ${dateFilter}
    `,
      params,
    );

    return {
      reportType: 'profit_loss',
      period: { dateFrom, dateTo },
      revenue: {
        total: Number(revenue[0]?.total_revenue || 0),
        breakdown: await tenantDb.query(
          `
          SELECT 
            ft.source_module,
            COALESCE(SUM(fp.amount), 0) AS amount
          FROM financial_payments fp
          INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
          WHERE fp.status = 'completed' ${dateFilter}
          GROUP BY ft.source_module
        `,
          params,
        ),
      },
      expenses: {
        total: 0,
        note: 'Expense tracking not yet implemented',
      },
      profit: {
        total: Number(revenue[0]?.total_revenue || 0),
      },
    };
  }

  private async getCashFlowReport(
    tenantDb: DataSource,
    dateFrom?: string,
    dateTo?: string,
    groupBy: string = 'month',
  ) {
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      dateFilter += ` AND fp.received_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      dateFilter += ` AND fp.received_at <= $${params.length}`;
    }

    let groupByClause = '';
    switch (groupBy) {
      case 'day':
        groupByClause = "DATE_TRUNC('day', fp.received_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', fp.received_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', fp.received_at)";
        break;
      case 'year':
        groupByClause = "DATE_TRUNC('year', fp.received_at)";
        break;
    }

    const cashFlow = await tenantDb.query(
      `
      SELECT 
        ${groupByClause} AS period,
        COALESCE(SUM(fp.amount), 0) AS cash_inflow
      FROM financial_payments fp
      WHERE fp.status = 'completed' ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `,
      params,
    );

    return {
      reportType: 'cash_flow',
      period: { dateFrom, dateTo, groupBy },
      cashFlow,
      summary: {
        totalInflow: cashFlow.reduce((sum, cf) => sum + Number(cf.cash_inflow || 0), 0),
        averageDailyInflow: cashFlow.length > 0
          ? cashFlow.reduce((sum, cf) => sum + Number(cf.cash_inflow || 0), 0) / cashFlow.length
          : 0,
      },
    };
  }

  private async getAgingReport(tenantDb: DataSource) {
    const aging = await tenantDb.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND (due_date IS NULL OR due_date >= CURRENT_DATE) THEN balance ELSE 0 END), 0) AS current,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days' THEN balance ELSE 0 END), 0) AS bucket_0_30,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days' THEN balance ELSE 0 END), 0) AS bucket_31_60,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days' THEN balance ELSE 0 END), 0) AS bucket_61_90,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND due_date < CURRENT_DATE - INTERVAL '90 days' THEN balance ELSE 0 END), 0) AS bucket_over_90
      FROM financial_transactions
    `,
    );

    const byPatient = await tenantDb.query(
      `
      SELECT
        ft.patient_id,
        p.first_name,
        p.last_name,
        p.patient_number,
        COALESCE(SUM(ft.balance), 0) AS total_balance,
        COUNT(*) AS transaction_count
      FROM financial_transactions ft
      LEFT JOIN patients p ON p.id = ft.patient_id
      WHERE ft.payment_status != 'paid' AND ft.balance > 0
      GROUP BY ft.patient_id, p.first_name, p.last_name, p.patient_number
      HAVING COALESCE(SUM(ft.balance), 0) > 0
      ORDER BY total_balance DESC
      LIMIT 50
    `,
    );

    return {
      reportType: 'aging',
      summary: aging[0] || {
        current: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_over_90: 0,
      },
      byPatient,
    };
  }

  async calculateTax(amount: number, taxRate: number = 0.15): Promise<{ taxAmount: number; totalWithTax: number }> {
    // Default 15% VAT for Zimbabwe
    const taxAmount = amount * taxRate;
    const totalWithTax = amount + taxAmount;
    return { taxAmount, totalWithTax };
  }

  async getTaxSummary(
    tenantDb: DataSource,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ totalRevenue: number; totalTax: number; taxBreakdown: any[] }> {
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      dateFilter += ` AND fp.received_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      dateFilter += ` AND fp.received_at <= $${params.length}`;
    }

    const taxSummary = await tenantDb.query(
      `
      SELECT 
        COALESCE(SUM(fli.tax), 0) AS total_tax,
        COALESCE(SUM(fp.amount), 0) AS total_revenue
      FROM financial_payments fp
      INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
      LEFT JOIN financial_line_items fli ON fli.transaction_id = ft.id
      WHERE fp.status = 'completed' ${dateFilter}
    `,
      params,
    );

    const taxBreakdown = await tenantDb.query(
      `
      SELECT 
        DATE_TRUNC('month', fp.received_at) AS period,
        COALESCE(SUM(fli.tax), 0) AS tax_amount,
        COALESCE(SUM(fp.amount), 0) AS revenue_amount
      FROM financial_payments fp
      INNER JOIN financial_transactions ft ON ft.id = fp.transaction_id
      LEFT JOIN financial_line_items fli ON fli.transaction_id = ft.id
      WHERE fp.status = 'completed' ${dateFilter}
      GROUP BY DATE_TRUNC('month', fp.received_at)
      ORDER BY period DESC
    `,
      params,
    );

    return {
      totalRevenue: Number(taxSummary[0]?.total_revenue || 0),
      totalTax: Number(taxSummary[0]?.total_tax || 0),
      taxBreakdown,
    };
  }

  async reconcilePayments(
    tenantDb: DataSource,
    reconciliationData: {
      transactionId: string;
      reconciliationDate: string;
      reconciledAmount: number;
      bankReference?: string;
      notes?: string;
    },
    userId: string,
  ) {
    await tenantDb.query('BEGIN');

    try {
      const [transaction] = await tenantDb.query(
        `SELECT id, balance, amount FROM financial_transactions WHERE id = $1 FOR UPDATE`,
        [reconciliationData.transactionId],
      );

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      // The actual table structure uses different column names
      await tenantDb.query(
        `
        INSERT INTO financial_reconciliation_logs (
          transaction_id,
          reconciliation_date,
          amount,
          payment_reference,
          status,
          metadata
        )
        VALUES ($1, $2, $3, $4, 'matched', $5)
      `,
        [
          reconciliationData.transactionId,
          new Date(reconciliationData.reconciliationDate),
          reconciliationData.reconciledAmount,
          reconciliationData.bankReference || null,
          JSON.stringify({ notes: reconciliationData.notes || null, reconciled_by: userId }),
        ],
      );

      await tenantDb.query('COMMIT');

      return { success: true, message: 'Payment reconciled successfully' };
    } catch (error) {
      await tenantDb.query('ROLLBACK');
      throw error;
    }
  }

  async getReconciliationReport(
    tenantDb: DataSource,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let dateFilter = '';
    const params: any[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      dateFilter += ` AND frl.reconciliation_date >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      dateFilter += ` AND frl.reconciliation_date <= $${params.length}`;
    }

    // Use try-catch to handle cases where financial_transactions might not exist or have different structure
    let reconciled;
    try {
      reconciled = await tenantDb.query(
        `
        SELECT 
          frl.*,
          COALESCE(ft.transaction_number, '') as transaction_number,
          COALESCE(ft.amount, 0) as transaction_amount,
          COALESCE(p.first_name, '') as first_name,
          COALESCE(p.last_name, '') as last_name,
          COALESCE(p.patient_number, '') as patient_number
        FROM financial_reconciliation_logs frl
        LEFT JOIN financial_transactions ft ON ft.id = frl.transaction_id
        LEFT JOIN patients p ON p.id = ft.patient_id
        WHERE 1=1 ${dateFilter}
        ORDER BY frl.reconciliation_date DESC
      `,
        params,
      );
    } catch (error) {
      // If join fails, return just the reconciliation logs
      reconciled = await tenantDb.query(
        `
        SELECT frl.*
        FROM financial_reconciliation_logs frl
        WHERE 1=1 ${dateFilter}
        ORDER BY frl.reconciliation_date DESC
      `,
        params,
      );
    }

    const summary = await tenantDb.query(
      `
      SELECT 
        COUNT(*) AS total_reconciled,
        COALESCE(SUM(frl.amount), 0) AS total_amount
      FROM financial_reconciliation_logs frl
      WHERE 1=1 ${dateFilter}
    `,
      params,
    );

    return {
      summary: summary[0] || { total_reconciled: 0, total_amount: 0 },
      reconciled,
    };
  }
}
