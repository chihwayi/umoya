// R3 / FX-019 RED: every provider callback verified before crediting.
// The audit's forged-Daraja reproduction must now fail for all five providers;
// replays rejected; duplicate legitimate callbacks idempotent (no double
// credit); currency must match the bill (single-currency-per-bill, no silent
// FX); the pre-existing status!=='pending' guard must still hold.
import { ForbiddenException } from '@nestjs/common';
import {
  verifyProviderCallback,
  CALLBACK_ENABLED_DEFAULTS,
  SUPPORTED_CURRENCIES,
  type CallbackHttpClient,
} from './payment-callback-verification';

const SECRET = 'per-tenant-webhook-secret';

function fakeTenantDb(opts: {
  webhookSecret?: string | null;
  billCurrency?: string | null;
  existingEvents?: any[];
  providerStatus?: string;
}) {
  const savedEvents: any[] = [];
  return {
    savedEvents,
    query: jest.fn(async (sql: string, params: any[] = []) => {
      if (/payment_gateway_configurations/.test(sql)) {
        return opts.webhookSecret === null || opts.webhookSecret === undefined
          ? []
          : [{ provider_type: 'x', webhook_secret: opts.webhookSecret, is_active: true }];
      }
      if (/FROM billing/.test(sql)) {
        return [{ id: 'bill-1', currency: opts.billCurrency ?? 'USD', total_amount: 25 }];
      }
      if (/FROM payment_provider_events/.test(sql) && /correlation_id/.test(sql)) {
        return (opts.existingEvents || []).filter((e) => e.correlation_id === params[1]);
      }
      if (/FROM payment_provider_events/.test(sql)) return opts.existingEvents || [];
      return [];
    }),
    getRepository: (entity: any) => {
      const name = entity?.name || '';
      if (name === 'PaymentProviderEvent') {
        return {
          create: (x: any) => x,
          save: jest.fn(async (x: any) => { savedEvents.push(x); return { id: `ev-${savedEvents.length}`, ...x }; }),
          findOne: jest.fn(async () => null),
          find: jest.fn(async () => opts.existingEvents || []),
        };
      }
      throw new Error(`unexpected repo ${name}`);
    },
  } as any;
}

const okQueryBack: CallbackHttpClient = {
  queryTransactionStatus: async () => ({ confirmed: true, amount: 25, currency: 'USD', reference: 'MPESA-OK' }),
};
const failedQueryBack: CallbackHttpClient = {
  queryTransactionStatus: async () => ({ confirmed: false }),
};

describe('R3 FX-019 provider callback verification (red)', () => {
  const providers = ['mpesa', 'mtn_momo', 'ecocash', 'airtel', 'flutterwave'] as const;

  test.each(providers)('forged %s callback with no valid proof is rejected before crediting', async (provider) => {
    const db = fakeTenantDb({ webhookSecret: SECRET });
    const forged: Record<string, any> = {
      mpesa: { Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: 'ATTACKER', AccountReference: 'bill-1', CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'ATTACKER-RECEIPT' }] } } } },
      mtn_momo: { status: 'SUCCESSFUL', externalId: 'bill-1', financialTransactionId: 'ATTACKER-REF' },
      ecocash: { transactionOperationStatus: 'Completed', clientCorrelator: 'bill-1', serverReferenceCode: 'ATTACKER-REF' },
      airtel: { transaction: { id: 'bill-1', status: 'TS', airtel_money_id: 'ATTACKER-REF' } },
      flutterwave: { data: { tx_ref: 'bill-1', status: 'successful', id: 'ATTACKER-ID' } },
    }[provider];
    await expect(
      verifyProviderCallback({
        provider, headers: {}, payload: forged, tenantDb: db, http: failedQueryBack,
        transactionId: 'tx-1', callbackEventId: 'replayable-1',
      }),
    ).rejects.toThrow();
    expect(db.savedEvents.filter((e: any) => e.providerStatus === 'COMPLETED')).toHaveLength(0);
  });

  test('flutterwave verif-hash verified against the per-tenant secret (timing-safe)', async () => {
    const db = fakeTenantDb({ webhookSecret: SECRET });
    const ok = await verifyProviderCallback({
      provider: 'flutterwave',
      headers: { 'verif-hash': SECRET },
      payload: { data: { tx_ref: 'tx-1', status: 'successful', id: 'FW-1' } },
      tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'fw-ev-1',
    });
    expect(ok.verified).toBe(true);
    // wrong secret fails closed
    await expect(
      verifyProviderCallback({
        provider: 'flutterwave', headers: { 'verif-hash': 'wrong' },
        payload: { data: { tx_ref: 'tx-1', status: 'successful', id: 'FW-2' } },
        tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'fw-ev-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  test('mpesa credits only after a successful Daraja query-back, never on callback word alone', async () => {
    const db = fakeTenantDb({ webhookSecret: SECRET });
    const payload = { Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: 'CO-1', CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'R-1' }] } } } };
    await expect(
      verifyProviderCallback({ provider: 'mpesa', headers: {}, payload, tenantDb: db, http: failedQueryBack, transactionId: 'tx-1', callbackEventId: 'mp-1' }),
    ).rejects.toThrow();
    const ok = await verifyProviderCallback({ provider: 'mpesa', headers: {}, payload, tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'mp-2' });
    expect(ok.verified).toBe(true);
    expect(ok.reference).toBe('MPESA-OK');
  });

  test('replayed callback (same provider event id) is rejected', async () => {
    const db = fakeTenantDb({
      webhookSecret: SECRET,
      existingEvents: [{ correlation_id: 'seen-ev-1', provider_status: 'COMPLETED' }],
    });
    await expect(
      verifyProviderCallback({
        provider: 'flutterwave', headers: { 'verif-hash': SECRET },
        payload: { data: { tx_ref: 'tx-1', status: 'successful', id: 'FW-1' } },
        tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'seen-ev-1',
      }),
    ).rejects.toThrow(/replay/i);
  });

  test('duplicate legitimate callback for an already-completed transaction is idempotent', async () => {
    const { MobileMoneyService } = require('./mobile-money.service');
    const creditSpy = jest.fn();
    const fakeDb: any = {
      getRepository: () => ({ findOne: async () => ({ id: 'tx-1', status: 'success', invoiceId: 'inv-1', amount: 25 }) }),
    };
    const svc = new MobileMoneyService(
      { getTenantDatabase: async () => fakeDb } as any,
      { addPayment: creditSpy } as any,
    );
    // status !== 'pending' skip is the idempotency half: no re-credit.
    await svc.handleCallback('t1', 'mpesa', { Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: 'CO-1' } } });
    expect(creditSpy).not.toHaveBeenCalled();
  });

  test('audit repro: forged Daraja callback on a PENDING transaction is rejected, no credit', async () => {
    const { MobileMoneyService } = require('./mobile-money.service');
    const creditSpy = jest.fn();
    const fakeDb: any = {
      query: async () => [],
      getRepository: (entity: any) => {
        if (entity?.name === 'MobileMoneyTransaction') {
          return {
            findOne: async () => ({
              id: 'tx-pend', status: 'pending', invoiceId: 'inv-9',
              amount: 25, currency: 'USD', phoneNumber: '0770000000',
            }),
            update: jest.fn(),
          };
        }
        if (entity?.name === 'PaymentProviderEvent') {
          return { create: (x: any) => x, save: async (x: any) => x, findOne: async () => null };
        }
        throw new Error(`unexpected ${entity?.name}`);
      },
    };
    const svc = new MobileMoneyService({ getTenantDatabase: async () => fakeDb } as any, {
      addPayment: creditSpy,
    } as any);
    const forged = {
      Body: {
        stkCallback: {
          ResultCode: 0,
          CheckoutRequestID: 'FORGED-CO',
          AccountReference: 'inv-9',
          CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'ATTACKER-RECEIPT' }] },
        },
      },
    };
    // No Daraja credentials in this environment ⇒ query-back cannot confirm
    // ⇒ fail closed. With credentials, a forged receipt still fails the
    // query-back and rejects the same way.
    await expect(svc.handleCallback('t1', 'mpesa', forged, { headers: {} })).rejects.toThrow();
    expect(creditSpy).not.toHaveBeenCalled();
  });

  test('ecocash and airtel are disabled by default until a mechanism is verified', () => {
    expect(CALLBACK_ENABLED_DEFAULTS.ecocash).toBe(false);
    expect(CALLBACK_ENABLED_DEFAULTS.airtel).toBe(false);
    expect(CALLBACK_ENABLED_DEFAULTS.mpesa).toBe(true);
    expect(CALLBACK_ENABLED_DEFAULTS.mtn_momo).toBe(true);
    expect(CALLBACK_ENABLED_DEFAULTS.flutterwave).toBe(true);
  });

  test('disabled provider callback is rejected even when well-formed', async () => {
    const db = fakeTenantDb({ webhookSecret: SECRET });
    await expect(
      verifyProviderCallback({
        provider: 'ecocash', headers: {}, payload: { transactionOperationStatus: 'Completed', clientCorrelator: 'tx-1' },
        tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'eco-1',
      }),
    ).rejects.toThrow(/disabled/i);
  });

  test('callback currency must match the bill; unknown codes rejected (single-currency-per-bill)', async () => {
    const db = fakeTenantDb({ webhookSecret: SECRET, billCurrency: 'USD' });
    await expect(
      verifyProviderCallback({
        provider: 'flutterwave', headers: { 'verif-hash': SECRET },
        payload: { data: { tx_ref: 'tx-1', status: 'successful', id: 'FW-9', currency: 'ZiG' } },
        tenantDb: db, http: okQueryBack, transactionId: 'tx-1', callbackEventId: 'fx-1', billId: 'bill-1',
      }),
    ).rejects.toThrow(/currency/i);
    expect(SUPPORTED_CURRENCIES).toContain('USD');
  });
});
