import { NotFoundException } from '@nestjs/common';
import { PatientPortalService } from './patient-portal.service';
import { BillStatus } from '../entities/billing.entity';

describe('PatientPortalService finance guidance', () => {
  const buildService = (options?: {
    bill?: any;
    transactionRows?: any[];
    financeQuote?: any;
  }) => {
    const billRepository = {
      findOne: jest.fn().mockResolvedValue(options?.bill || null),
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM financial_transactions')) {
        return options?.transactionRows || [];
      }
      return [];
    });
    const tenantDb = {
      query,
      getRepository: jest.fn((entity: any) => {
        if (entity?.name === 'Bill') {
          return billRepository;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    };
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const financeService = {
      generatePatientQuote: jest.fn().mockResolvedValue(
        options?.financeQuote || {
          id: 'quote-1',
          transactionId: 'txn-1',
          quoteStatus: 'verified_quote',
          estimatedPatientResponsibility: 20,
          estimatedPayerAmount: 80,
          recommendedNextStep: 'Collect the expected patient portion at check-in.',
        },
      ),
    };

    return {
      service: new PatientPortalService(tenantService as any, {} as any, financeService as any),
      tenantService,
      financeService,
      tenantDb,
      billRepository,
    };
  };

  it('returns persisted finance quote guidance when a billing transaction exists', async () => {
    const { service, financeService } = buildService({
      bill: {
        id: 'bill-1',
        patientId: 'patient-1',
      },
      transactionRows: [{ id: 'txn-1' }],
      financeQuote: {
        id: 'quote-1',
        transactionId: 'txn-1',
        quoteStatus: 'verified_quote',
        estimatedPatientResponsibility: 35,
        estimatedPayerAmount: 65,
        recommendedNextStep: 'Collect the expected patient portion at check-in.',
      },
    });

    const result = await service.getPatientBillQuote('patient-1', 'bill-1', 'kids-clinic');

    expect(financeService.generatePatientQuote).toHaveBeenCalledWith(expect.anything(), 'txn-1');
    expect(result).toEqual(
      expect.objectContaining({
        transactionId: 'txn-1',
        quoteStatus: 'verified_quote',
        estimatedPatientResponsibility: 35,
      }),
    );
  });

  it('falls back to self-pay guidance when no billing transaction exists', async () => {
    const { service, financeService } = buildService({
      bill: {
        id: 'bill-2',
        patientId: 'patient-2',
        appointmentId: 'appt-2',
        totalAmount: 125,
        status: BillStatus.PENDING,
      },
      transactionRows: [],
    });

    const result = await service.getPatientBillQuote('patient-2', 'bill-2', 'kids-clinic');

    expect(financeService.generatePatientQuote).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        billId: 'bill-2',
        quoteStatus: 'self_pay',
        estimatedPatientResponsibility: 125,
        estimatedPayerAmount: 0,
      }),
    );
  });

  it('rejects quote lookups for missing bills', async () => {
    const { service } = buildService({
      bill: null,
    });

    await expect(service.getPatientBillQuote('patient-1', 'missing-bill', 'kids-clinic')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
