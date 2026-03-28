import { Injectable } from '@nestjs/common';
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
  confidenceScore: number;
  matchReason: string;
  matchedBy?: string;
  matchedAt?: Date;
}

export interface PaymentAnomaly {
  id?: string;
  bankEntryId?: string | null;
  paymentId?: string | null;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high';
  anomalyScore: number;
  status?: string;
  summary: string;
  evidence: Record<string, any>;
  detectedAt?: Date;
}

export interface ReconciliationFilters {
  startDate?: string;
  endDate?: string;
  status?: 'matched' | 'unmatched' | 'all';
  paymentMethod?: string;
}

export interface PaymentAnomalyFilters {
  startDate?: string;
  endDate?: string;
  status?: 'open' | 'resolved' | 'all';
  severity?: 'low' | 'medium' | 'high';
  limit?: number;
}

@Injectable()
export class PaymentReconciliationService {
  async importBankStatement(
    tenantDb: DataSource,
    entries: BankStatementEntry[],
    statementDate: Date,
  ): Promise<any> {
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
          entry.reference || null,
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

    const bankEntryIds = insertedEntries.map((entry: any) => entry.id);
    const matches = await this.autoMatchPayments(tenantDb, bankEntryIds);
    const anomalies = await this.scanForAnomalies(tenantDb, { bankEntryIds });

    return {
      imported: insertedEntries.length,
      entries: insertedEntries,
      matches,
      anomalies,
    };
  }

  async autoMatchPayments(
    tenantDb: DataSource,
    bankEntryIds?: string[],
  ): Promise<PaymentMatch[]> {
    let query = `
      SELECT
        bs.id AS bank_entry_id,
        bs.entry_date,
        bs.amount AS bank_amount,
        bs.reference AS bank_reference,
        bs.description AS bank_description,
        fp.id AS payment_id,
        fp.amount AS payment_amount,
        fp.payment_reference,
        fp.gateway_reference,
        fp.received_at,
        fp.payment_method
      FROM bank_statements bs
      JOIN financial_payments fp ON
        ABS(bs.amount - fp.amount) < 0.01
        AND ABS(EXTRACT(EPOCH FROM (bs.entry_date::timestamp - fp.received_at::timestamp)) / 86400) <= 7
      WHERE bs.is_matched = false
        AND bs.entry_type = 'credit'
        AND fp.status = 'completed'
        AND COALESCE(fp.reconciliation_status, 'unmatched') != 'matched'
    `;

    const params: any[] = [];

    if (bankEntryIds && bankEntryIds.length > 0) {
      query += ` AND bs.id = ANY($${params.length + 1}::uuid[])`;
      params.push(bankEntryIds);
    }

    query += ` ORDER BY bs.entry_date DESC, fp.received_at DESC`;

    const candidates = await tenantDb.query(query, params);
    const bestMatches = new Map<string, PaymentMatch>();
    const candidateCounts = new Map<string, number>();

    for (const candidate of candidates) {
      if (!candidate.payment_id) {
        continue;
      }

      const paymentReference = String(
        candidate.payment_reference || candidate.gateway_reference || '',
      ).trim();
      const bankReference = String(candidate.bank_reference || '').trim();
      const amountMatch = Math.abs(Number(candidate.bank_amount) - Number(candidate.payment_amount)) < 0.01;
      const dateDiff = Math.abs(
        (new Date(candidate.entry_date).getTime() - new Date(candidate.received_at).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const exactReferenceMatch =
        bankReference.length > 0 && paymentReference.length > 0 && bankReference === paymentReference;
      const partialReferenceMatch =
        !exactReferenceMatch &&
        bankReference.length > 0 &&
        paymentReference.length > 0 &&
        (bankReference.includes(paymentReference) || paymentReference.includes(bankReference));

      let confidenceScore = amountMatch ? 55 : 0;
      let reason = 'Amount matches';

      if (exactReferenceMatch) {
        confidenceScore += 30;
        reason = 'Amount and exact reference match';
      } else if (partialReferenceMatch) {
        confidenceScore += 20;
        reason = 'Amount and partial reference match';
      } else if (!bankReference) {
        confidenceScore += 10;
        reason = 'Amount matches but bank reference is missing';
      }

      if (dateDiff <= 1) {
        confidenceScore += 15;
      } else if (dateDiff <= 3) {
        confidenceScore += 10;
      } else {
        confidenceScore += 5;
      }

      let matchConfidence: 'high' | 'medium' | 'low' = 'low';
      if (confidenceScore >= 90) {
        matchConfidence = 'high';
        reason = `${reason}; date is within 1 day`;
      } else if (confidenceScore >= 70) {
        matchConfidence = 'medium';
        reason = `${reason}; date proximity supports the match`;
      }

      const match: PaymentMatch = {
        bankEntryId: candidate.bank_entry_id,
        paymentId: candidate.payment_id,
        matchConfidence,
        confidenceScore,
        matchReason: reason,
      };

      candidateCounts.set(match.bankEntryId, (candidateCounts.get(match.bankEntryId) || 0) + 1);

      const existing = bestMatches.get(match.bankEntryId);
      if (!existing || existing.confidenceScore < confidenceScore) {
        bestMatches.set(match.bankEntryId, match);
      }
    }

    const paymentMatches = Array.from(bestMatches.values());
    const consumedPaymentIds = new Set<string>();

    for (const match of paymentMatches) {
      const candidateCount = candidateCounts.get(match.bankEntryId) || 0;
      if (candidateCount > 1) {
        await this.recordAnomalyFlag(tenantDb, {
          bankEntryId: match.bankEntryId,
          paymentId: match.paymentId,
          anomalyType: 'multiple_match_candidates',
          severity: 'medium',
          anomalyScore: 72,
          summary: 'A bank entry matched multiple possible payments and requires review.',
          evidence: {
            bankEntryId: match.bankEntryId,
            candidateCount,
            selectedPaymentId: match.paymentId,
            confidenceScore: match.confidenceScore,
          },
        });
      }

      if (match.matchConfidence === 'high' && !consumedPaymentIds.has(match.paymentId)) {
        await this.matchPayment(
          tenantDb,
          match.bankEntryId,
          match.paymentId,
          'system',
          match.matchConfidence,
          match.matchReason,
        );
        consumedPaymentIds.add(match.paymentId);
        continue;
      }

      await this.recordAnomalyFlag(tenantDb, {
        bankEntryId: match.bankEntryId,
        paymentId: match.paymentId,
        anomalyType: 'low_confidence_reconciliation_match',
        severity: match.matchConfidence === 'medium' ? 'medium' : 'high',
        anomalyScore: match.confidenceScore,
        summary: 'A payment match candidate needs human review before reconciliation.',
        evidence: {
          bankEntryId: match.bankEntryId,
          paymentId: match.paymentId,
          confidence: match.matchConfidence,
          confidenceScore: match.confidenceScore,
          reason: match.matchReason,
        },
      });
    }

    return paymentMatches;
  }

  async matchPayment(
    tenantDb: DataSource,
    bankEntryId: string,
    paymentId: string,
    matchedBy: string,
    matchConfidence = 'manual',
    matchReason: string | null = null,
  ): Promise<any> {
    await tenantDb.query(
      `UPDATE bank_statements
       SET is_matched = true,
           matched_payment_id = $1,
           matched_at = NOW(),
           matched_by = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [paymentId, matchedBy, bankEntryId],
    );

    await tenantDb.query(
      `UPDATE financial_payments
       SET reconciliation_status = 'matched',
           reconciled_at = NOW(),
           reconciled_by = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [matchedBy, paymentId],
    );

    const [reconciliation] = await tenantDb.query(
      `INSERT INTO payment_reconciliations (
        bank_entry_id, payment_id, match_confidence, match_reason, matched_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [bankEntryId, paymentId, matchConfidence, matchReason, matchedBy],
    );

    await this.resolveAnomaliesForMatch(tenantDb, bankEntryId, paymentId);

    return {
      ...reconciliation,
      matchedAt: reconciliation.matched_at,
      matchConfidence: reconciliation.match_confidence,
      matchReason: reconciliation.match_reason,
    };
  }

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
        AND COALESCE(fp.reconciliation_status, 'unmatched') != 'matched'
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
      totalAmount: payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0),
      payments: payments.map((payment: any) => ({
        id: payment.id,
        amount: Number(payment.amount || 0),
        paymentMethod: payment.payment_method,
        reference: payment.payment_reference || payment.gateway_reference || null,
        receivedAt: payment.received_at,
        patientName: `${payment.first_name || ''} ${payment.last_name || ''}`.trim(),
        patientNumber: payment.patient_number,
        billNumber: payment.bill_number,
        sourceModule: payment.source_module,
        reconciliationStatus: payment.reconciliation_status || 'unmatched',
      })),
    };
  }

  async getUnmatchedBankEntries(
    tenantDb: DataSource,
    filters?: ReconciliationFilters,
  ): Promise<any> {
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
      totalAmount: entries.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
      entries: entries.map((entry: any) => ({
        id: entry.id,
        date: entry.entry_date,
        description: entry.description,
        amount: Number(entry.amount || 0),
        reference: entry.reference,
        type: entry.entry_type,
      })),
    };
  }

  async getAnomalies(
    tenantDb: DataSource,
    filters?: PaymentAnomalyFilters,
  ): Promise<any> {
    let query = `
      SELECT
        paf.*,
        bs.reference AS bank_reference,
        bs.amount AS bank_amount,
        fp.payment_reference,
        fp.gateway_reference,
        fp.amount AS payment_amount
      FROM payment_anomaly_flags paf
      LEFT JOIN bank_statements bs ON bs.id = paf.bank_entry_id
      LEFT JOIN financial_payments fp ON fp.id = paf.payment_id
      WHERE 1 = 1
    `;

    const params: any[] = [];

    if (filters?.status && filters.status !== 'all') {
      query += ` AND paf.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters?.severity) {
      query += ` AND paf.severity = $${params.length + 1}`;
      params.push(filters.severity);
    }

    if (filters?.startDate) {
      query += ` AND paf.detected_at >= $${params.length + 1}`;
      params.push(new Date(filters.startDate));
    }

    if (filters?.endDate) {
      query += ` AND paf.detected_at <= $${params.length + 1}`;
      params.push(new Date(filters.endDate));
    }

    query += ` ORDER BY paf.detected_at DESC`;

    const limit = Math.max(1, Math.min(Number(filters?.limit || 100), 500));
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);

    const anomalies = await tenantDb.query(query, params);

    return {
      count: anomalies.length,
      anomalies: anomalies.map((row: any) => ({
        id: row.id,
        bankEntryId: row.bank_entry_id,
        paymentId: row.payment_id,
        anomalyType: row.anomaly_type,
        severity: row.severity,
        anomalyScore: Number(row.anomaly_score || 0),
        status: row.status,
        summary: row.summary,
        evidence: row.evidence || {},
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at,
        reference: row.bank_reference || row.payment_reference || row.gateway_reference || null,
        bankAmount: row.bank_amount !== null ? Number(row.bank_amount || 0) : null,
        paymentAmount: row.payment_amount !== null ? Number(row.payment_amount || 0) : null,
      })),
    };
  }

  async getReconciliationReport(
    tenantDb: DataSource,
    filters: ReconciliationFilters,
  ): Promise<any> {
    const unmatchedPayments = await this.getUnmatchedPayments(tenantDb, filters);
    const unmatchedBankEntries = await this.getUnmatchedBankEntries(tenantDb, filters);
    const anomalies = await this.getAnomalies(tenantDb, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: 'open',
      limit: 50,
    });

    const [matchedData] = await tenantDb.query(
      `SELECT
        COUNT(*) AS matched_count,
        COALESCE(SUM(fp.amount), 0) AS matched_amount
       FROM financial_payments fp
       WHERE fp.status = 'completed'
         AND COALESCE(fp.reconciliation_status, 'unmatched') = 'matched'
         AND fp.received_at >= $1
         AND fp.received_at <= $2`,
      [new Date(filters.startDate || new Date(0)), new Date(filters.endDate || new Date())],
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
        openAnomalies: anomalies.count,
        reconciliationRate:
          Number(matchedData?.matched_count || 0) > 0
            ? (Number(matchedData.matched_count) /
                (Number(matchedData.matched_count) + unmatchedPayments.count)) *
              100
            : 0,
      },
      unmatchedPayments: unmatchedPayments.payments,
      unmatchedBankEntries: unmatchedBankEntries.entries,
      anomalies: anomalies.anomalies,
    };
  }

  async scanForAnomalies(
    tenantDb: DataSource,
    options?: { bankEntryIds?: string[] },
  ): Promise<PaymentAnomaly[]> {
    const anomalies: PaymentAnomaly[] = [];

    let unmatchedBankQuery = `
      SELECT
        bs.id,
        bs.reference,
        bs.amount,
        bs.entry_date,
        bs.description
      FROM bank_statements bs
      WHERE bs.is_matched = false
        AND bs.entry_type = 'credit'
        AND bs.entry_date <= CURRENT_DATE - INTERVAL '2 days'
    `;
    const bankParams: any[] = [];

    if (options?.bankEntryIds && options.bankEntryIds.length > 0) {
      unmatchedBankQuery += ` AND bs.id = ANY($${bankParams.length + 1}::uuid[])`;
      bankParams.push(options.bankEntryIds);
    }

    const unmatchedBankEntries = await tenantDb.query(unmatchedBankQuery, bankParams);
    for (const entry of unmatchedBankEntries) {
      anomalies.push(
        await this.recordAnomalyFlag(tenantDb, {
          bankEntryId: entry.id,
          anomalyType: 'unmatched_bank_credit',
          severity: 'high',
          anomalyScore: 88,
          summary: 'A bank credit remains unmatched for more than 48 hours.',
          evidence: {
            reference: entry.reference,
            amount: Number(entry.amount || 0),
            entryDate: entry.entry_date,
            description: entry.description,
          },
        }),
      );
    }

    const stalePayments = await tenantDb.query(
      `
        SELECT
          fp.id,
          fp.payment_reference,
          fp.gateway_reference,
          fp.amount,
          fp.received_at
        FROM financial_payments fp
        WHERE fp.status = 'completed'
          AND COALESCE(fp.reconciliation_status, 'unmatched') != 'matched'
          AND fp.received_at <= NOW() - INTERVAL '2 days'
      `,
    );

    for (const payment of stalePayments) {
      anomalies.push(
        await this.recordAnomalyFlag(tenantDb, {
          paymentId: payment.id,
          anomalyType: 'stale_unmatched_payment',
          severity: 'medium',
          anomalyScore: 76,
          summary: 'A completed payment remains unreconciled for more than 48 hours.',
          evidence: {
            reference: payment.payment_reference || payment.gateway_reference || null,
            amount: Number(payment.amount || 0),
            receivedAt: payment.received_at,
          },
        }),
      );
    }

    let duplicateReferenceQuery = `
      SELECT
        MIN(bs.id) AS representative_bank_entry_id,
        bs.reference,
        bs.amount,
        COUNT(*)::int AS duplicate_count,
        ARRAY_AGG(bs.id) AS bank_entry_ids
      FROM bank_statements bs
      WHERE bs.entry_type = 'credit'
        AND COALESCE(bs.reference, '') != ''
      GROUP BY bs.reference, bs.amount
      HAVING COUNT(*) > 1
    `;
    const duplicateParams: any[] = [];

    if (options?.bankEntryIds && options.bankEntryIds.length > 0) {
      duplicateReferenceQuery = `
        SELECT
          MIN(bs.id) AS representative_bank_entry_id,
          bs.reference,
          bs.amount,
          COUNT(*)::int AS duplicate_count,
          ARRAY_AGG(bs.id) AS bank_entry_ids
        FROM bank_statements bs
        WHERE bs.entry_type = 'credit'
          AND COALESCE(bs.reference, '') != ''
          AND bs.id = ANY($1::uuid[])
        GROUP BY bs.reference, bs.amount
        HAVING COUNT(*) > 1
      `;
      duplicateParams.push(options.bankEntryIds);
    }

    const duplicateReferences = await tenantDb.query(duplicateReferenceQuery, duplicateParams);
    for (const group of duplicateReferences) {
      anomalies.push(
        await this.recordAnomalyFlag(tenantDb, {
          bankEntryId: group.representative_bank_entry_id,
          anomalyType: 'duplicate_bank_reference',
          severity: 'medium',
          anomalyScore: 68,
          summary: 'Multiple bank entries share the same reference and amount.',
          evidence: {
            reference: group.reference,
            amount: Number(group.amount || 0),
            duplicateCount: Number(group.duplicate_count || 0),
            bankEntryIds: group.bank_entry_ids || [],
          },
        }),
      );
    }

    return anomalies;
  }

  private async recordAnomalyFlag(
    tenantDb: DataSource,
    anomaly: PaymentAnomaly,
  ): Promise<PaymentAnomaly> {
    const fingerprint = this.buildAnomalyFingerprint(anomaly);
    const [row] = await tenantDb.query(
      `
        INSERT INTO payment_anomaly_flags (
          bank_entry_id,
          payment_id,
          anomaly_type,
          severity,
          anomaly_score,
          status,
          fingerprint,
          summary,
          evidence
        )
        VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)
        ON CONFLICT (fingerprint) DO UPDATE
        SET severity = EXCLUDED.severity,
            anomaly_score = EXCLUDED.anomaly_score,
            summary = EXCLUDED.summary,
            evidence = EXCLUDED.evidence,
            detected_at = NOW(),
            updated_at = NOW()
        RETURNING *
      `,
      [
        anomaly.bankEntryId || null,
        anomaly.paymentId || null,
        anomaly.anomalyType,
        anomaly.severity,
        anomaly.anomalyScore,
        fingerprint,
        anomaly.summary,
        JSON.stringify(anomaly.evidence || {}),
      ],
    );

    return {
      id: row.id,
      bankEntryId: row.bank_entry_id,
      paymentId: row.payment_id,
      anomalyType: row.anomaly_type,
      severity: row.severity,
      anomalyScore: Number(row.anomaly_score || 0),
      status: row.status,
      summary: row.summary,
      evidence: row.evidence || {},
      detectedAt: row.detected_at,
    };
  }

  private async resolveAnomaliesForMatch(
    tenantDb: DataSource,
    bankEntryId: string,
    paymentId: string,
  ) {
    await tenantDb.query(
      `
        UPDATE payment_anomaly_flags
        SET status = 'resolved',
            resolved_at = NOW(),
            resolution_notes = COALESCE(resolution_notes, 'Resolved by payment reconciliation match.'),
            updated_at = NOW()
        WHERE status != 'resolved'
          AND (
            bank_entry_id = $1
            OR payment_id = $2
          )
      `,
      [bankEntryId, paymentId],
    );
  }

  private buildAnomalyFingerprint(anomaly: PaymentAnomaly) {
    return [
      anomaly.anomalyType,
      anomaly.bankEntryId || 'none',
      anomaly.paymentId || 'none',
      String(anomaly.evidence?.reference || anomaly.evidence?.paymentReference || '').trim() || 'none',
      String(anomaly.evidence?.amount || anomaly.evidence?.bankEntryIds?.join(',') || '').trim() || 'none',
    ].join(':');
  }
}
