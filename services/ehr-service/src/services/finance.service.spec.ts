import { FinanceService } from './finance.service';
import { FinancialQuoteAssessment } from '../entities/financial-quote-assessment.entity';

describe('FinanceService', () => {
  const makeTenantDb = (options?: {
    transaction?: any;
    lineItems?: any[];
    bill?: any;
    claim?: any;
    verification?: any;
    clearance?: any;
  }) => {
    const quoteRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({
        id: 'quote-1',
        quotedAt: new Date('2026-03-25T10:30:00.000Z'),
        createdAt: new Date('2026-03-25T10:30:00.000Z'),
        updatedAt: new Date('2026-03-25T10:30:00.000Z'),
        ...input,
      })),
    };

    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM financial_transactions ft') && sql.includes('WHERE ft.id = $1')) {
        return options?.transaction ? [options.transaction] : [];
      }
      if (sql.includes('FROM financial_line_items WHERE transaction_id = $1')) {
        return options?.lineItems || [];
      }
      if (sql.includes('FROM financial_payments WHERE transaction_id = $1')) {
        return [];
      }
      if (sql.includes('FROM financial_claims WHERE transaction_id = $1')) {
        return [];
      }
      if (sql.includes('FROM financial_reconciliation_logs WHERE transaction_id = $1')) {
        return [];
      }
      if (sql.includes('FROM billing') && sql.includes('appointment_id')) {
        return options?.bill ? [options.bill] : [];
      }
      if (sql.includes('FROM medical_aid_claims')) {
        return options?.claim ? [options.claim] : [];
      }
      if (sql.includes('FROM insurance_verifications')) {
        return options?.verification ? [options.verification] : [];
      }
      if (sql.includes('FROM financial_clearance_assessments')) {
        return options?.clearance ? [options.clearance] : [];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    return {
      query,
      getRepository: jest.fn((entity) => {
        if (entity === FinancialQuoteAssessment) {
          return quoteRepo;
        }
        throw new Error(`Unexpected repository: ${entity?.name}`);
      }),
      __quoteRepo: quoteRepo,
    } as any;
  };

  it('generates a self-pay quote with full patient responsibility', async () => {
    const service = new FinanceService();
    const tenantDb = makeTenantDb({
      transaction: {
        id: 'txn-1',
        patient_id: 'patient-1',
        payer_type: 'self',
        source_module: 'appointments',
        source_reference_id: 'appt-1',
        amount: '125.00',
      },
      lineItems: [
        { description: 'Consultation', billing_code: 'CONSULT', total: '125.00' },
      ],
      bill: {
        id: 'bill-1',
        appointment_id: 'appt-1',
      },
    });

    const quote = await service.generatePatientQuote(tenantDb, 'txn-1');

    expect(quote.quoteStatus).toBe('self_pay');
    expect(quote.estimatedPayerAmount).toBe(0);
    expect(quote.estimatedPatientResponsibility).toBe(125);
    expect(tenantDb.__quoteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteStatus: 'self_pay',
        totalCharge: 125,
      }),
    );
  });

  it('prefers verified insurance and clearance signals for a medical-aid quote', async () => {
    const service = new FinanceService();
    const tenantDb = makeTenantDb({
      transaction: {
        id: 'txn-2',
        patient_id: 'patient-2',
        payer_type: 'medical_aid',
        source_module: 'billing',
        source_reference_id: 'bill-22',
        amount: '200.00',
      },
      lineItems: [
        { description: 'Lab panel', billing_code: 'LAB', total: '200.00' },
      ],
      bill: {
        id: 'bill-22',
        appointment_id: 'appt-22',
      },
      claim: {
        id: 'claim-22',
        billing_id: 'bill-22',
        medical_aid_name: 'Cimas',
        member_number: 'MEM-22',
      },
      verification: {
        id: 'verify-22',
        verification_status: 'verified',
        coverage_details: { coveredPercentage: 85 },
        copay_amount: '15.00',
        deductible_remaining: '10.00',
      },
      clearance: {
        id: 'clearance-22',
        payer_estimated_amount: '150.00',
        estimated_responsibility: '50.00',
        blockers: [],
        recommended_next_step: 'Collect the expected patient portion at check-in.',
      },
    });

    const quote = await service.generatePatientQuote(tenantDb, 'txn-2');

    expect(quote.quoteStatus).toBe('verified_quote');
    expect(quote.quoteConfidence).toBe('high');
    expect(quote.estimatedPayerAmount).toBe(150);
    expect(quote.estimatedPatientResponsibility).toBe(50);
    expect(quote.recommendedNextStep).toBe('Collect the expected patient portion at check-in.');
  });
});
