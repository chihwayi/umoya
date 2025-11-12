import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFinanceTransactionDto, FinanceLineItemDto, RecordPaymentDto } from '../dto/finance.dto';
import { PAYMENT_STATUS, PaymentStatus } from '../constants/payment-status';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  private mapFinanceStatusToPaymentStatus(financeStatus: string): PaymentStatus {
    if (financeStatus === 'paid') {
      return PAYMENT_STATUS.PAYMENT_CONFIRMED;
    }
    if (financeStatus === 'cancelled') {
      return PAYMENT_STATUS.CANCELLED;
    }
    return PAYMENT_STATUS.AWAITING_PAYMENT;
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
        userId || null,
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

  async recordPayment(tenantDb: DataSource, transactionId: string, payload: RecordPaymentDto, userId: string) {
    if (!payload.amount || payload.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    await tenantDb.query('BEGIN');

    try {
      const [transaction] = await tenantDb.query(
        `SELECT id, amount, balance, payment_status, source_module, source_reference_id FROM financial_transactions WHERE id = $1 FOR UPDATE`,
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
}

