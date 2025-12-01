import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface BankStatementEntry {
  date: Date;
  description: string;
  amount: number;
  reference: string;
  type: 'credit' | 'debit';
}

export interface PaymentMatch {
  bankEntryId: string;
  paymentId: string;
  matchConfidence: 'high' | 'medium' | 'low';
  matchReason: string;
  matchedBy?: string;
  matchedAt?: Date;
}

export interface ReconciliationFilters {
  startDate: string;
  endDate: string;
  status?: 'matched' | 'unmatched' | 'all';
  paymentMethod?: string;
}

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  /**
   * Import bank statement entries
   */
  async importBankStatement(
    tenantDb: DataSource,
    entries: BankStatementEntry[],
    statementDate: Date,
  ): Promise<any> {
    // Check if bank_statements table exists
    const tableExists = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bank_statements'
      )
    `);

    if (!tableExists[0]?.exists) {
      // Create table if it doesn't exist
      await tenantDb.query(`
        CREATE TABLE IF NOT EXISTS bank_statements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          statement_date DATE NOT NULL,
          entry_date DATE NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          reference VARCHAR(255),
          entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
          is_matched BOOLEAN DEFAULT false,
          matched_payment_id UUID,
          matched_at TIMESTAMP WITH TIME ZONE,
          matched_by UUID REFERENCES users(id),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await tenantDb.query(`
        CREATE INDEX IF NOT EXISTS idx_bank_statements_date ON bank_statements(entry_date)
      `);
      await tenantDb.query(`
        CREATE INDEX IF NOT EXISTS idx_bank_statements_matched ON bank_statements(is_matched)
      `);
    }

    // Insert entries
    const insertedEntries = [];
    for (const entry of entries) {
      const result = await tenantDb.query(
        `INSERT INTO bank_statements (
          statement_date, entry_date, description, amount, reference, entry_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          statementDate,
          entry.date,
          entry.description,
          entry.amount,
          entry.reference,
          entry.type,
        ],
      );

      insertedEntries.push({
        ...result[0],
        amount: Number(result[0].amount || 0),
        entryDate: result[0].entry_date,
        statementDate: result[0].statement_date,
        isMatched: result[0].is_matched || false,
      });
    }

    // Auto-match payments
    await this.autoMatchPayments(tenantDb, insertedEntries.map((e: any) => e.id));

    return {
      imported: insertedEntries.length,
      entries: insertedEntries,
    };
  }

  /**
   * Auto-match payments with bank statement entries
   */
  async autoMatchPayments(
    tenantDb: DataSource,
    bankEntryIds?: string[],
  ): Promise<PaymentMatch[]> {
    let query = `
      SELECT 
        bs.id as bank_entry_id,
        bs.entry_date,
        bs.amount as bank_amount,
        bs.reference as bank_reference,
        bs.description as bank_description,
        fp.id as payment_id,
        fp.amount as payment_amount,
        fp.reference as payment_reference,
        fp.received_at,
        fp.payment_method
      FROM bank_statements bs
      LEFT JOIN financial_payments fp ON 
        (
          ABS(bs.amount - fp.amount) < 0.01
          AND (
            bs.reference = fp.reference
            OR bs.reference LIKE '%' || fp.reference || '%'
            OR fp.reference LIKE '%' || bs.reference || '%'
          )
          AND ABS(EXTRACT(EPOCH FROM (bs.entry_date::timestamp - fp.received_at::timestamp)) / 86400) <= 7
        )
      WHERE bs.is_matched = false
        AND fp.status = 'completed'
        AND fp.reconciliation_status IS NULL
    `;

    const params: any[] = [];

    if (bankEntryIds && bankEntryIds.length > 0) {
      query += ` AND bs.id = ANY($${params.length + 1}::uuid[])`;
      params.push(bankEntryIds);
    }

    const matches = await tenantDb.query(query, params);

    const paymentMatches: PaymentMatch[] = [];

    for (const match of matches) {
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let reason = '';

      // Determine match confidence
      const amountMatch = Math.abs(Number(match.bank_amount) - Number(match.payment_amount)) < 0.01;
      const referenceMatch = match.bank_reference && match.payment_reference &&
        (match.bank_reference === match.payment_reference ||
         match.bank_reference.includes(match.payment_reference) ||
         match.payment_reference.includes(match.bank_reference));
      const dateDiff = Math.abs(
        (new Date(match.entry_date).getTime() - new Date(match.received_at).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (amountMatch && referenceMatch && dateDiff <= 1) {
        confidence = 'high';
        reason = 'Amount, reference, and date match';
      } else if (amountMatch && dateDiff <= 3) {
        confidence = 'medium';
        reason = 'Amount and date match';
      } else if (amountMatch) {
        confidence = 'low';
        reason = 'Amount matches';
      }

      paymentMatches.push({
        bankEntryId: match.bank_entry_id,
        paymentId: match.payment_id,
        matchConfidence: confidence,
        matchReason: reason,
      });
    }

    // Auto-match high confidence matches
    for (const match of paymentMatches) {
      if (match.matchConfidence === 'high') {
        await this.matchPayment(
          tenantDb,
          match.bankEntryId,
          match.paymentId,
          'system',
        );
      }
    }

    return paymentMatches;
  }

  /**
   * Manually match a payment with a bank statement entry
   */
  async matchPayment(
    tenantDb: DataSource,
    bankEntryId: string,
    paymentId: string,
    matchedBy: string,
  ): Promise<any> {
    // Update bank statement entry
    await tenantDb.query(
      `UPDATE bank_statements 
       SET is_matched = true,
           matched_payment_id = $1,
           matched_at = NOW(),
           matched_by = $2
       WHERE id = $3`,
      [paymentId, matchedBy, bankEntryId],
    );

    // Update payment reconciliation status
    await tenantDb.query(
      `UPDATE financial_payments 
       SET reconciliation_status = 'matched',
           reconciled_at = NOW(),
           reconciled_by = $1
       WHERE id = $2`,
      [matchedBy, paymentId],
    );

    // Create reconciliation record
    const reconciliationTableExists = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reconciliations'
      )
    `);

    if (!reconciliationTableExists[0]?.exists) {
      await tenantDb.query(`
        CREATE TABLE IF NOT EXISTS payment_reconciliations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_entry_id UUID NOT NULL,
          payment_id UUID NOT NULL,
          matched_by UUID REFERENCES users(id),
          matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
    }

    const [reconciliation] = await tenantDb.query(
      `INSERT INTO payment_reconciliations (
        bank_entry_id, payment_id, matched_by
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [bankEntryId, paymentId, matchedBy],
    );

    return {
      ...reconciliation,
      matchedAt: reconciliation.matched_at,
    };
  }

  /**
   * Get unmatched payments
   */
  async getUnmatchedPayments(
    tenantDb: DataSource,
    filters?: ReconciliationFilters,
  ): Promise<any> {
    let query = `
      SELECT 
        fp.*,
        ft.source_module,
        ft.source_reference_id,
        p.first_name,
        p.last_name,
        p.patient_number,
        b.bill_number
      FROM financial_payments fp
      LEFT JOIN financial_transactions ft ON ft.id = fp.transaction_id
      LEFT JOIN patients p ON p.id = ft.patient_id
      LEFT JOIN billing b ON b.id::text = ft.source_reference_id
      WHERE fp.status = 'completed'
        AND (fp.reconciliation_status IS NULL OR fp.reconciliation_status != 'matched')
    `;

    const params: any[] = [];

    if (filters?.startDate) {
      query += ` AND fp.received_at >= $${params.length + 1}`;
      params.push(new Date(filters.startDate));
    }

    if (filters?.endDate) {
      query += ` AND fp.received_at <= $${params.length + 1}`;
      params.push(new Date(filters.endDate));
    }

    if (filters?.paymentMethod) {
      query += ` AND fp.payment_method = $${params.length + 1}`;
      params.push(filters.paymentMethod);
    }

    query += ` ORDER BY fp.received_at DESC`;

    const payments = await tenantDb.query(query, params);

    return {
      count: payments.length,
      totalAmount: payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
      payments: payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount || 0),
        paymentMethod: p.payment_method,
        reference: p.reference,
        receivedAt: p.received_at,
        patientName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        patientNumber: p.patient_number,
        billNumber: p.bill_number,
        sourceModule: p.source_module,
      })),
    };
  }

  /**
   * Get unmatched bank entries
   */
  async getUnmatchedBankEntries(
    tenantDb: DataSource,
    filters?: ReconciliationFilters,
  ): Promise<any> {
    const tableExists = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bank_statements'
      )
    `);

    if (!tableExists[0]?.exists) {
      return {
        count: 0,
        totalAmount: 0,
        entries: [],
      };
    }

    let query = `
      SELECT *
      FROM bank_statements
      WHERE is_matched = false
        AND entry_type = 'credit'
    `;

    const params: any[] = [];

    if (filters?.startDate) {
      query += ` AND entry_date >= $${params.length + 1}`;
      params.push(new Date(filters.startDate));
    }

    if (filters?.endDate) {
      query += ` AND entry_date <= $${params.length + 1}`;
      params.push(new Date(filters.endDate));
    }

    query += ` ORDER BY entry_date DESC`;

    const entries = await tenantDb.query(query, params);

    return {
      count: entries.length,
      totalAmount: entries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
      entries: entries.map((e: any) => ({
        id: e.id,
        date: e.entry_date,
        description: e.description,
        amount: Number(e.amount || 0),
        reference: e.reference,
        type: e.entry_type,
      })),
    };
  }

  /**
   * Get reconciliation report
   */
  async getReconciliationReport(
    tenantDb: DataSource,
    filters: ReconciliationFilters,
  ): Promise<any> {
    const unmatchedPayments = await this.getUnmatchedPayments(tenantDb, filters);
    const unmatchedBankEntries = await this.getUnmatchedBankEntries(tenantDb, filters);

    // Get matched payments count
    const [matchedData] = await tenantDb.query(
      `SELECT 
        COUNT(*) as matched_count,
        COALESCE(SUM(fp.amount), 0) as matched_amount
       FROM financial_payments fp
       WHERE fp.status = 'completed'
         AND fp.reconciliation_status = 'matched'
         AND fp.received_at >= $1
         AND fp.received_at <= $2`,
      [new Date(filters.startDate), new Date(filters.endDate)],
    );

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      summary: {
        matchedPayments: {
          count: Number(matchedData?.matched_count || 0),
          amount: Number(matchedData?.matched_amount || 0),
        },
        unmatchedPayments: {
          count: unmatchedPayments.count,
          amount: unmatchedPayments.totalAmount,
        },
        unmatchedBankEntries: {
          count: unmatchedBankEntries.count,
          amount: unmatchedBankEntries.totalAmount,
        },
        reconciliationRate: matchedData?.matched_count > 0
          ? (Number(matchedData.matched_count) / (Number(matchedData.matched_count) + unmatchedPayments.count)) * 100
          : 0,
      },
      unmatchedPayments: unmatchedPayments.payments,
      unmatchedBankEntries: unmatchedBankEntries.entries,
    };
  }
}



