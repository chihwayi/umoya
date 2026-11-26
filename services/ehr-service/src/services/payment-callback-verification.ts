// R3 / FX-019 (S-012, P-005) — payment callback verification: the SINGLE
// mechanism every provider callback passes through before anything is
// credited. One lookup table (provider → method), one check function, wired
// into both callback paths (mobile-money webhooks and the generic
// provider-callback route). Fail closed throughout: unknown provider,
// disabled provider, missing secret, failed query-back, replayed event id,
// currency mismatch, or unverifiable payload all reject — never credit.
//
// Per-provider mechanisms (documented, no fake-safe claims):
// - flutterwave: native `verif-hash` header, timing-safe compared against the
//   tenant's per-tenant webhook_secret (payment_gateway_configurations).
// - mpesa (Daraja): callbacks carry no signature. Authenticity is established
//   by an OAuth query-back (STK/transaction-status query) with the tenant's
//   credentials. ResultCode:0 alone NEVER credits.
// - mtn_momo: same pattern — GET requesttopay status with the provisioned
//   token. Callback word alone NEVER credits.
// - ecocash / airtel / onemoney: no provider-documented callback
//   authentication this sprint could verify against a live contract, so they
//   stay DISABLED by default (CALLBACK_ENABLED_DEFAULTS + per-provider
//   PAYMENT_CALLBACK_<ID>_ENABLED kill-switch, default OFF). When enabled in
//   future, they authenticate under Umoya's documented shared-secret contract
//   (X-Callback-Signature = HMAC-SHA256 over eventId.transactionId.status,
//   keyed by the tenant webhook_secret) — never on payload word alone.
// - Anything else: rejected as unsupported.
//
// Currency (P-005): single-currency-per-bill, no silent FX. The callback
// currency must be allowlisted AND match the bill currency. ZiG and unknown
// codes are rejected outright — no conversion layer ships this sprint (see
// remediation/R3_CURRENCY_DECISION.md).
import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentProviderEvent } from '../entities/payment-provider-event.entity';

export type CallbackProviderId =
  | 'mpesa'
  | 'mtn_momo'
  | 'flutterwave'
  | 'ecocash'
  | 'airtel'
  | 'onemoney';

type VerifyMethod = 'query-back' | 'native-shared-secret' | 'contract-hmac' | 'disabled';

/** One lookup table — the R2 lesson: one mechanism, not per-route patches. */
const PROVIDER_TABLE: Record<CallbackProviderId, { method: VerifyMethod }> = {
  mpesa: { method: 'query-back' },
  mtn_momo: { method: 'query-back' },
  flutterwave: { method: 'native-shared-secret' },
  ecocash: { method: 'contract-hmac' },
  airtel: { method: 'contract-hmac' },
  onemoney: { method: 'contract-hmac' },
};

/** Providers whose callbacks are accepted without an explicit opt-in. */
export const CALLBACK_ENABLED_DEFAULTS: Record<CallbackProviderId, boolean> = {
  mpesa: true,
  mtn_momo: true,
  flutterwave: true,
  ecocash: false,
  airtel: false,
  onemoney: false,
};

/** No conversion layer ships this sprint — only these codes verify. */
export const SUPPORTED_CURRENCIES = ['USD', 'ZWL'];

const ALIASES: Record<string, CallbackProviderId> = {
  mpesa: 'mpesa',
  daraja: 'mpesa',
  'm-pesa': 'mpesa',
  mtn_momo: 'mtn_momo',
  mtnmomo: 'mtn_momo',
  mtn: 'mtn_momo',
  flutterwave: 'flutterwave',
  flw: 'flutterwave',
  ecocash: 'ecocash',
  'eco-cash': 'ecocash',
  airtel: 'airtel',
  airtelmoney: 'airtel',
  onemoney: 'onemoney',
  'one-money': 'onemoney',
};

export function normalizeCallbackProvider(raw: unknown): CallbackProviderId {
  const key = String(raw ?? '').toLowerCase().trim();
  const mapped = ALIASES[key];
  if (!mapped) {
    throw new BadRequestException(`Unsupported payment provider callback: ${String(raw ?? '')}`);
  }
  return mapped;
}

export function isProviderCallbackEnabled(provider: CallbackProviderId): boolean {
  const env = process.env[`PAYMENT_CALLBACK_${provider.toUpperCase()}_ENABLED`];
  if (env !== undefined) {
    return ['1', 'true', 'yes', 'on'].includes(env.toLowerCase().trim());
  }
  return CALLBACK_ENABLED_DEFAULTS[provider];
}

export interface QueryBackResult {
  confirmed: boolean;
  amount?: number;
  currency?: string;
  reference?: string;
}

export interface CallbackHttpClient {
  queryTransactionStatus(args: {
    provider: CallbackProviderId;
    transactionId: string;
    reference?: string | null;
  }): Promise<QueryBackResult>;
}

/** Fail-closed stub: cannot query back ⇒ cannot verify ⇒ reject. */
export const NEVER_CONFIRM_HTTP: CallbackHttpClient = {
  queryTransactionStatus: async () => ({ confirmed: false }),
};

export interface VerifyProviderCallbackArgs {
  provider: string;
  headers: Record<string, any>;
  payload: any;
  tenantDb: any;
  http: CallbackHttpClient;
  transactionId: string;
  callbackEventId: string;
  billId?: string | null;
}

export interface VerifyProviderCallbackResult {
  verified: true;
  provider: CallbackProviderId;
  outcome: 'COMPLETED' | 'FAILED' | 'PENDING';
  reference: string | null;
  amount?: number | null;
  currency?: string | null;
}

function header(headers: Record<string, any>, name: string): string {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (k.toLowerCase() === want) return String(v ?? '');
  }
  return '';
}

function timingSafeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

function dig(obj: any, ...paths: string[][]): any {
  for (const path of paths) {
    let cur: any = obj;
    let ok = true;
    for (const key of path) {
      if (cur === null || cur === undefined || typeof cur !== 'object' || !(key in cur)) {
        ok = false;
        break;
      }
      cur = cur[key];
    }
    if (ok && cur !== undefined && cur !== null && String(cur) !== '') return cur;
  }
  return null;
}

/** Provider event id: the replay-protection key. Missing id ⇒ fail closed. */
export function extractCallbackEventId(
  provider: CallbackProviderId,
  payload: any,
  headers: Record<string, any>,
): string {
  const id =
    provider === 'mpesa'
      ? dig(payload, ['Body', 'stkCallback', 'CheckoutRequestID'])
      : provider === 'mtn_momo'
        ? header(headers, 'x-reference-id') ||
          dig(payload, ['referenceId'], ['externalId'], ['financialTransactionId'])
        : provider === 'flutterwave'
          ? dig(payload, ['data', 'id'])
          : provider === 'ecocash'
            ? dig(payload, ['clientCorrelator'])
            : provider === 'airtel'
              ? dig(payload, ['transaction', 'id'])
              : dig(payload, ['transactionId'], ['referenceId'], ['id']);
  if (!id) {
    throw new BadRequestException(`${provider} callback carries no provider event id — cannot replay-protect, rejected`);
  }
  return String(id);
}

function extractOutcome(provider: CallbackProviderId, payload: any): 'COMPLETED' | 'FAILED' | 'PENDING' {
  const s = (v: unknown) => String(v ?? '').toUpperCase();
  if (provider === 'mpesa') {
    const code = dig(payload, ['Body', 'stkCallback', 'ResultCode']);
    if (code === null || code === undefined) return 'PENDING';
    return Number(code) === 0 ? 'COMPLETED' : 'FAILED';
  }
  if (provider === 'mtn_momo') {
    return s(dig(payload, ['status'])) === 'SUCCESSFUL' ? 'COMPLETED'
      : s(dig(payload, ['status'], ['reason'])) ? 'FAILED' : 'PENDING';
  }
  if (provider === 'flutterwave') {
    return s(dig(payload, ['data', 'status'])) === 'SUCCESSFUL' ? 'COMPLETED' : 'FAILED';
  }
  if (provider === 'ecocash') {
    // Native EcoCash merchant callbacks use transactionOperationStatus; the
    // generic provider-callback route also accepts the normalized `status`.
    const raw = dig(payload, ['transactionOperationStatus']) ?? dig(payload, ['status']);
    return s(raw) === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
  }
  if (provider === 'airtel') {
    return s(dig(payload, ['transaction', 'status'])) === 'TS' ? 'COMPLETED' : 'FAILED';
  }
  return s(dig(payload, ['status'])) === 'SUCCESSFUL' || s(dig(payload, ['status'])) === 'COMPLETED'
    ? 'COMPLETED'
    : 'FAILED';
}

function extractReference(provider: CallbackProviderId, payload: any): string | null {
  const ref =
    provider === 'mpesa'
      ? (dig(payload, ['Body', 'stkCallback', 'CallbackMetadata', 'Item']) as any[])?.find?.(
          (i: any) => i?.Name === 'MpesaReceiptNumber',
        )?.Value ?? null
      : provider === 'mtn_momo'
        ? dig(payload, ['financialTransactionId'])
        : provider === 'ecocash'
          ? dig(payload, ['serverReferenceCode'])
          : provider === 'airtel'
            ? dig(payload, ['transaction', 'airtel_money_id'])
            : provider === 'flutterwave'
              ? dig(payload, ['data', 'id'])
              : dig(payload, ['reference'], ['paymentReference']);
  return ref === null ? null : String(ref);
}

function extractCurrency(payload: any): string | null {
  const cur = dig(payload, ['currency'], ['data', 'currency'], ['transaction', 'currency']);
  return cur === null ? null : String(cur).toUpperCase();
}

function extractAmount(payload: any): number | null {
  const raw = dig(payload, ['amount'], ['data', 'amount'], ['transaction', 'amount']);
  const n = Number(raw);
  return raw === null || !Number.isFinite(n) ? null : n;
}

/**
 * The single check every provider callback passes through before anything is
 * credited. Throws (rejects) on any ambiguity; returns the verified outcome.
 */
export async function verifyProviderCallback(
  args: VerifyProviderCallbackArgs,
): Promise<VerifyProviderCallbackResult> {
  const provider = normalizeCallbackProvider(args.provider);
  const entry = PROVIDER_TABLE[provider];

  if (!isProviderCallbackEnabled(provider) || entry.method === 'disabled') {
    await recordCallbackAttempt(args, extractOutcome(provider, args.payload), 'REJECTED', 'provider disabled');
    throw new ForbiddenException(`payment provider ${provider} callbacks are disabled — no unverified provider stays open`);
  }
  if (!args.transactionId) {
    throw new BadRequestException('transactionId is required');
  }
  if (!args.callbackEventId) {
    throw new BadRequestException('callback event id is required for replay protection');
  }

  // ── Replay protection: the same provider event id twice ⇒ rejected. ──
  const seen = await args.tenantDb.query(
    `SELECT id, provider_status FROM payment_provider_events
     WHERE provider_type = $1 AND correlation_id = $2 LIMIT 1`,
    [provider, args.callbackEventId],
  );
  if (Array.isArray(seen) && seen.length > 0) {
    throw new ConflictException(
      `replayed ${provider} callback rejected (event ${args.callbackEventId} already processed)`,
    );
  }

  const outcome = extractOutcome(provider, args.payload);

  if (entry.method === 'native-shared-secret') {
    // Flutterwave: native verif-hash vs the per-tenant secret.
    const configs = await args.tenantDb.query(
      `SELECT webhook_secret, is_active FROM payment_gateway_configurations
       WHERE is_active = true AND provider_type = $1 LIMIT 1`,
      [provider],
    );
    const secret = String(configs?.[0]?.webhook_secret ?? '');
    const received = header(args.headers, 'verif-hash');
    if (!secret || !timingSafeCompare(received, secret)) {
      await recordCallbackAttempt(args, outcome, 'REJECTED', 'invalid webhook signature');
      throw new ForbiddenException(`invalid ${provider} webhook signature`);
    }
  }
  let confirmedReference: string | null = null;
  if (entry.method === 'query-back') {
    // Daraja / MTN: callback word alone never credits — the provider must
    // confirm over OAuth with the tenant's credentials.
    let confirmation: QueryBackResult = { confirmed: false };
    try {
      confirmation = await args.http.queryTransactionStatus({
        provider,
        transactionId: args.transactionId,
        reference: extractReference(provider, args.payload),
      });
    } catch {
      confirmation = { confirmed: false };
    }
    if (!confirmation.confirmed) {
      await recordCallbackAttempt(args, outcome, 'REJECTED', 'provider did not confirm the payment on query-back');
      throw new ForbiddenException(`${provider} did not confirm the payment — callback word alone never credits`);
    }
    if (confirmation.currency) {
      assertCurrencyAllowed(confirmation.currency);
    }
    confirmedReference = confirmation.reference ?? null;
  } else if (entry.method === 'contract-hmac') {
    // contract-hmac providers (ecocash/airtel/onemoney): enabled only, with
    // the tenant's per-tenant secret under Umoya's documented contract.
    const configs = await args.tenantDb.query(
      `SELECT webhook_secret, is_active FROM payment_gateway_configurations
       WHERE is_active = true AND provider_type = $1 LIMIT 1`,
      [provider],
    );
    const secret = String(configs?.[0]?.webhook_secret ?? '');
    const received = header(args.headers, 'x-callback-signature');
    const expected = secret
      ? createHmac('sha256', secret)
          .update(`${args.callbackEventId}.${args.transactionId}.${outcome}`)
          .digest('hex')
      : '';
    if (!secret || !timingSafeCompare(received, expected)) {
      await recordCallbackAttempt(args, outcome, 'REJECTED', 'invalid callback signature');
      throw new ForbiddenException(`invalid ${provider} callback signature`);
    }
  }

  // ── Currency: allowlisted AND matching the bill (single-currency-per-bill,
  // no silent FX). ──
  const payloadCurrency = extractCurrency(args.payload);
  if (payloadCurrency) assertCurrencyAllowed(payloadCurrency);
  if (args.billId) {
    const bills = await args.tenantDb.query(
      `SELECT id, currency FROM billing WHERE id = $1 LIMIT 1`,
      [args.billId],
    );
    const billCurrency = bills?.[0]?.currency ? String(bills[0].currency).toUpperCase() : null;
    const effective = payloadCurrency;
    if (billCurrency && SUPPORTED_CURRENCIES.includes(billCurrency) && effective && effective !== billCurrency) {
      await recordCallbackAttempt(args, outcome, 'REJECTED', `currency mismatch: callback ${effective} vs bill ${billCurrency}`);
      throw new BadRequestException(
        `currency mismatch: callback is ${effective} but the bill is ${billCurrency} — no silent FX conversion`,
      );
    }
  }

  const verified = await recordCallbackAttempt(
    args,
    outcome,
    outcome === 'COMPLETED' ? 'COMPLETED' : outcome === 'FAILED' ? 'FAILED' : 'PENDING_CONFIRMATION',
    null,
  );
  return {
    verified: true,
    provider,
    outcome,
    // The query-back confirmation is authoritative over the callback's
    // self-reported receipt number.
    reference: confirmedReference ?? extractReference(provider, args.payload),
    amount: extractAmount(args.payload),
    currency: payloadCurrency,
  };
}

function assertCurrencyAllowed(currency: string): void {
  if (!SUPPORTED_CURRENCIES.includes(String(currency).toUpperCase())) {
    throw new BadRequestException(
      `unsupported currency ${currency} — single-currency-per-bill, no conversion layer this sprint (USD/ZWL only)`,
    );
  }
}

const verifyLogger = new Logger('PaymentCallbackVerification');

/** Daraja STK/transaction-status query-back (OAuth, per existing env contract). */
export const darajaQueryBackClient: CallbackHttpClient = {
  queryTransactionStatus: async ({ reference }) => {
    const base = (process.env.MPESA_BASE_URL || '').replace(/\/$/, '');
    const key = process.env.MPESA_CONSUMER_KEY || '';
    const secret = process.env.MPESA_CONSUMER_SECRET || '';
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey = process.env.MPESA_PASSKEY || '';
    if (!base || !key || !secret || !shortcode || !passkey || !reference) {
      verifyLogger.warn('Daraja query-back unavailable (missing credentials or reference) — failing closed');
      return { confirmed: false };
    }
    const token64 = Buffer.from(`${key}:${secret}`).toString('base64');
    const authRes = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${token64}` },
    });
    const token: string = authRes.data.access_token;
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const res = await axios.post(
      `${base}/mpesa/stkpushquery/v1/query`,
      { BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: reference },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const ok = Number(res.data?.ResultCode) === 0;
    return {
      confirmed: ok,
      reference: res.data?.MpesaReceiptNumber ? String(res.data.MpesaReceiptNumber) : String(reference),
      amount: res.data?.Amount !== undefined ? Number(res.data.Amount) : undefined,
    };
  },
};

/** MTN MoMo request-to-pay status query-back (OAuth, per existing env contract). */
export const mtnQueryBackClient: CallbackHttpClient = {
  queryTransactionStatus: async ({ transactionId }) => {
    const base = (process.env.MTN_BASE_URL || '').replace(/\/$/, '');
    const subKey = process.env.MTN_SUBSCRIPTION_KEY || '';
    const apiUser = process.env.MTN_API_USER || '';
    const apiKey = process.env.MTN_API_KEY || '';
    if (!base || !subKey || !apiUser || !apiKey || !transactionId) {
      verifyLogger.warn('MTN query-back unavailable (missing credentials) — failing closed');
      return { confirmed: false };
    }
    const token64 = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
    const tokenRes = await axios.post(
      `${base}/collection/token/`,
      {},
      { headers: { Authorization: `Basic ${token64}`, 'Ocp-Apim-Subscription-Key': subKey } },
    );
    const res = await axios.get(`${base}/collection/v1_0/requesttopay/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${tokenRes.data.access_token}`,
        'Ocp-Apim-Subscription-Key': subKey,
        'X-Target-Environment': 'sandbox',
      },
    });
    const status = String(res.data?.status || '').toUpperCase();
    return {
      confirmed: status === 'SUCCESSFUL',
      reference: res.data?.financialTransactionId ? String(res.data.financialTransactionId) : transactionId,
      amount: res.data?.amount !== undefined ? Number(res.data.amount) : undefined,
      currency: res.data?.currency ? String(res.data.currency).toUpperCase() : undefined,
    };
  },
};

/** Query-back client by provider for callbacks that support it. */
export function queryBackClientFor(provider: CallbackProviderId): CallbackHttpClient {
  if (provider === 'mpesa') return darajaQueryBackClient;
  if (provider === 'mtn_momo') return mtnQueryBackClient;
  return NEVER_CONFIRM_HTTP;
}

async function recordCallbackAttempt(
  args: VerifyProviderCallbackArgs,
  outcome: 'COMPLETED' | 'FAILED' | 'PENDING',
  providerStatus: string,
  reason: string | null,
): Promise<void> {
  try {
    const eventRepo = args.tenantDb.getRepository(PaymentProviderEvent);
    if (!eventRepo || typeof eventRepo.create !== 'function') return;
    const entry = eventRepo.create({
      transactionId: args.transactionId,
      billId: args.billId ?? null,
      providerType: normalizeCallbackProvider(args.provider),
      eventType: providerStatus === 'REJECTED' ? 'callback_rejected' : 'provider_callback',
      providerStatus,
      reference: extractReference(normalizeCallbackProvider(args.provider), args.payload),
      correlationId: args.callbackEventId,
      requestPayload: {},
      responsePayload: { outcome, reason },
    });
    await eventRepo.save(entry);
  } catch {
    // Audit recording must never convert a rejection into an approval.
  }
}
