import axios from 'axios';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Bill } from '../entities/billing.entity';
import { PaymentGatewayConfig, PaymentProviderType } from '../entities/payment-gateway-config.entity';
import { PaymentProviderEvent } from '../entities/payment-provider-event.entity';
import { PaymentVerificationAttempt } from '../entities/payment-verification-attempt.entity';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('PaymentsService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  const makeTenantDb = (options?: {
    bill?: any;
    config?: any;
    latestEvent?: any;
    latestVerification?: any;
  }) => {
    const billRepo = {
      findOne: jest.fn().mockResolvedValue(options?.bill || null),
    };
    const configRepo = {
      findOne: jest.fn().mockResolvedValue(options?.config || null),
    };
    const eventRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({
        id: 'event-1',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        ...input,
      })),
      findOne: jest.fn().mockResolvedValue(options?.latestEvent || null),
    };
    const verificationRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({
        id: 'verify-1',
        attemptedAt: new Date('2026-03-25T08:05:00.000Z'),
        createdAt: new Date('2026-03-25T08:05:00.000Z'),
        ...input,
      })),
      findOne: jest.fn().mockResolvedValue(options?.latestVerification || null),
    };

    const query = jest.fn().mockResolvedValue([]);

    return {
      query,
      getRepository: jest.fn((entity) => {
        if (entity === Bill) return billRepo;
        if (entity === PaymentGatewayConfig) return configRepo;
        if (entity === PaymentProviderEvent) return eventRepo;
        if (entity === PaymentVerificationAttempt) return verificationRepo;
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
      __repos: {
        billRepo,
        configRepo,
        eventRepo,
        verificationRepo,
      },
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails closed when the tenant payment gateway is not configured', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      bill: { id: 'bill-1' },
      config: null,
    });

    const result = await service.processMobileMoneyPayment(
      {
        billId: 'bill-1',
        amount: 25,
        phoneNumber: '0772000000',
        provider: 'ecocash',
      },
      tenantDb,
    );

    expect(result.status).toBe('CONFIGURATION_REQUIRED');
    expect(tenantDb.__repos.eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'initiation_failed',
        providerStatus: 'CONFIGURATION_ERROR',
      }),
    );
  });

  it('fails closed when EcoCash-specific credentials are missing', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      bill: { id: 'bill-ecocash-config' },
      config: {
        providerType: PaymentProviderType.ECOCASH,
        apiUrl: 'https://provider.example.com',
        merchantId: 'merchant-ecocash',
        integrationKey: '',
      },
    });

    const result = await service.processEcoCashPayment(
      {
        billId: 'bill-ecocash-config',
        amount: 25,
        phoneNumber: '0772000000',
        currency: 'USD',
      },
      tenantDb,
    );

    expect(result.status).toBe('CONFIGURATION_REQUIRED');
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(tenantDb.__repos.eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayload: expect.objectContaining({
          missingConfiguration: expect.objectContaining({
            missingFields: ['integrationKey'],
          }),
        }),
      }),
    );
  });

  it('returns deterministic pending status for initiated payments', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      latestEvent: {
        transactionId: 'ECO_123',
        providerType: PaymentProviderType.ECOCASH,
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
        eventType: 'payment_initiated',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ECO_123',
        requestPayload: { amount: 40, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-2',
      },
    });

    const result = await service.getPaymentStatus('ECO_123', tenantDb);

    expect(result.status).toBe('PENDING');
    expect(result.provider).toBe('EcoCash');
    expect(result.amount).toBe(40);
  });

  it('calls the configured provider endpoint when initiating a payment', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        status: 'pending_provider_confirmation',
        correlationId: 'corr-1',
        reference: 'GW-REF-1',
        instructions: 'Approve payment in your wallet.',
      },
    } as any);

    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      bill: { id: 'bill-11' },
      config: {
        providerType: PaymentProviderType.ECOCASH,
        apiUrl: 'https://provider.example.com',
        merchantId: 'merchant-1',
        apiKey: 'api-key-1',
        integrationKey: 'int-key-1',
        apiSecret: 'secret-1',
        webhookUrl: 'https://callback.example.com',
        metadata: {
          initiationPath: '/wallet/initiate',
        },
      },
    });

    const result = await service.processEcoCashPayment(
      {
        billId: 'bill-11',
        amount: 25,
        phoneNumber: '0772000000',
        currency: 'USD',
      },
      tenantDb,
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://provider.example.com/wallet/initiate',
      expect.objectContaining({
        merchantId: 'merchant-1',
        integrationKey: 'int-key-1',
        billId: 'bill-11',
        amount: 25,
        msisdn: '0772000000',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'api-key-1',
          'x-integration-key': 'int-key-1',
          authorization: 'Bearer secret-1',
        }),
      }),
    );
    expect(result.status).toBe('PENDING');
    expect(result.reference).toBe('GW-REF-1');
    expect(tenantDb.__repos.eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'payment_initiated',
        correlationId: 'corr-1',
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
      }),
    );
  });

  it('marks payments verified only when a completed provider event exists', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      latestEvent: {
        transactionId: 'ONE_123',
        providerType: PaymentProviderType.ONEMONEY,
        providerStatus: 'COMPLETED',
        eventType: 'provider_callback',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ONE_123',
        requestPayload: { amount: 55, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-3',
      },
    });

    const result = await service.verifyPayment('ONE_123', 'REF_ONE_123', tenantDb);

    expect(result.verified).toBe(true);
    expect(result.status).toBe('VERIFIED');
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billing'),
      expect.arrayContaining(['paid', 'REF_ONE_123', 'onemoney', 'bill-3']),
    );
  });

  it('refreshes provider status before verification when the latest event is still pending', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'completed',
        reference: 'REF_ONE_REFRESH',
        correlationId: 'corr-refresh',
      },
    } as any);

    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      latestEvent: {
        transactionId: 'ONE_PENDING_1',
        providerType: PaymentProviderType.ONEMONEY,
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
        eventType: 'payment_initiated',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ONE_PENDING_1',
        requestPayload: { amount: 55, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-33',
      },
      config: {
        providerType: PaymentProviderType.ONEMONEY,
        apiUrl: 'https://provider.example.com',
        merchantId: 'merchant-2',
        apiKey: 'one-api-key',
        metadata: {
          statusPath: '/wallet/status',
        },
      },
    });

    tenantDb.__repos.eventRepo.findOne
      .mockResolvedValueOnce({
        transactionId: 'ONE_PENDING_1',
        providerType: PaymentProviderType.ONEMONEY,
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
        eventType: 'payment_initiated',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ONE_PENDING_1',
        requestPayload: { amount: 55, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-33',
      })
      .mockResolvedValueOnce({
        transactionId: 'ONE_PENDING_1',
        providerType: PaymentProviderType.ONEMONEY,
        providerStatus: 'COMPLETED',
        eventType: 'status_refresh',
        eventTimestamp: new Date('2026-03-25T08:10:00.000Z'),
        createdAt: new Date('2026-03-25T08:10:00.000Z'),
        reference: 'REF_ONE_REFRESH',
        requestPayload: {},
        responsePayload: { amount: 55, currency: 'USD' },
        billId: 'bill-33',
      });

    const result = await service.verifyPayment('ONE_PENDING_1', undefined, tenantDb);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://provider.example.com/wallet/status',
      expect.objectContaining({
        params: expect.objectContaining({
          transactionId: 'ONE_PENDING_1',
          merchantId: 'merchant-2',
          apiKey: 'one-api-key',
        }),
      }),
    );
    expect(result.verified).toBe(true);
    expect(result.reference).toBe('REF_ONE_REFRESH');
  });

  it('records provider callbacks and derives completed status from persisted events', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb({
      latestEvent: {
        transactionId: 'ECO_999',
        providerType: PaymentProviderType.ECOCASH,
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
        eventType: 'payment_initiated',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ECO_999',
        requestPayload: { amount: 85, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-9',
      },
    });

    tenantDb.__repos.eventRepo.findOne
      .mockResolvedValueOnce({
        transactionId: 'ECO_999',
        providerType: PaymentProviderType.ECOCASH,
        providerStatus: 'PENDING_PROVIDER_CONFIRMATION',
        eventType: 'payment_initiated',
        eventTimestamp: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        reference: 'REF_ECO_999',
        requestPayload: { amount: 85, currency: 'USD' },
        responsePayload: {},
        billId: 'bill-9',
      })
      .mockResolvedValueOnce({
        transactionId: 'ECO_999',
        providerType: PaymentProviderType.ECOCASH,
        providerStatus: 'COMPLETED',
        eventType: 'provider_callback',
        eventTimestamp: new Date('2026-03-25T08:10:00.000Z'),
        createdAt: new Date('2026-03-25T08:10:00.000Z'),
        reference: 'REF_ECO_999',
        requestPayload: {},
        responsePayload: { amount: 85, currency: 'USD' },
        billId: 'bill-9',
      });

    const result = await service.recordProviderCallback(
      {
        transactionId: 'ECO_999',
        provider: 'ecocash',
        status: 'completed',
        reference: 'REF_ECO_999',
      },
      tenantDb,
    );

    expect(result.status).toBe('COMPLETED');
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billing'),
      expect.arrayContaining(['paid', 'REF_ECO_999', 'ecocash', 'bill-9']),
    );
  });

  it('throws not found when a status lookup has no persisted event', async () => {
    const service = new PaymentsService();
    const tenantDb = makeTenantDb();

    await expect(service.getPaymentStatus('missing', tenantDb)).rejects.toBeInstanceOf(NotFoundException);
  });
});
