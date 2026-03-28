import { PaymentReconciliationService } from './payment-reconciliation.service';

describe('PaymentReconciliationService', () => {
  const makeTenantDb = () => {
    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM bank_statements bs') && sql.includes('JOIN financial_payments fp')) {
        return [
          {
            bank_entry_id: 'bank-1',
            entry_date: '2026-03-22T00:00:00.000Z',
            bank_amount: '25.00',
            bank_reference: '',
            bank_description: 'Clinic deposit',
            payment_id: 'payment-1',
            payment_amount: '25.00',
            payment_reference: 'PAY-25',
            gateway_reference: null,
            received_at: '2026-03-20T00:00:00.000Z',
            payment_method: 'mobile_money',
          },
        ];
      }

      if (sql.includes('INSERT INTO payment_anomaly_flags')) {
        return [
          {
            id: 'anomaly-1',
            bank_entry_id: params?.[0] || null,
            payment_id: params?.[1] || null,
            anomaly_type: params?.[2],
            severity: params?.[3],
            anomaly_score: params?.[4],
            status: 'open',
            summary: params?.[6],
            evidence: JSON.parse(params?.[7] || '{}'),
            detected_at: new Date('2026-03-25T10:00:00.000Z'),
          },
        ];
      }

      if (sql.includes('SELECT') && sql.includes("FROM bank_statements bs") && sql.includes("CURRENT_DATE - INTERVAL '2 days'")) {
        return [];
      }

      if (sql.includes('FROM financial_payments fp') && sql.includes("NOW() - INTERVAL '2 days'")) {
        return [];
      }

      if (sql.includes('GROUP BY bs.reference, bs.amount')) {
        return [];
      }

      if (sql.includes('UPDATE bank_statements')) {
        return [];
      }

      if (sql.includes('UPDATE financial_payments')) {
        return [];
      }

      if (sql.includes('INSERT INTO payment_reconciliations')) {
        return [
          {
            id: 'recon-1',
            bank_entry_id: 'bank-1',
            payment_id: 'payment-1',
            match_confidence: 'high',
            match_reason: 'Amount and exact reference match; date is within 1 day',
            matched_at: new Date('2026-03-25T10:00:00.000Z'),
          },
        ];
      }

      return [];
    });

    return { query } as any;
  };

  it('uses payment_reference-based matching and persists low-confidence anomalies', async () => {
    const service = new PaymentReconciliationService();
    const tenantDb = makeTenantDb();

    const matches = await service.autoMatchPayments(tenantDb, ['bank-1']);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(
      expect.objectContaining({
        bankEntryId: 'bank-1',
        paymentId: 'payment-1',
        matchConfidence: 'medium',
      }),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('fp.payment_reference'),
      expect.any(Array),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_anomaly_flags'),
      expect.any(Array),
    );
  });

  it('writes reconciliation rows with confidence metadata and resolves anomalies on manual match', async () => {
    const service = new PaymentReconciliationService();
    const tenantDb = makeTenantDb();

    const result = await service.matchPayment(
      tenantDb,
      'bank-1',
      'payment-1',
      'user-1',
      'high',
      'Exact reference match',
    );

    expect(result.matchConfidence).toBe('high');
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET reconciliation_status = 'matched'"),
      expect.arrayContaining(['user-1', 'payment-1']),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_reconciliations'),
      expect.arrayContaining(['bank-1', 'payment-1', 'high', 'Exact reference match', 'user-1']),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payment_anomaly_flags'),
      expect.arrayContaining(['bank-1', 'payment-1']),
    );
  });
});
