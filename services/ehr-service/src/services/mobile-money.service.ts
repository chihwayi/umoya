/**
 * Mobile Money Service — S131
 *
 * Supports: M-Pesa Daraja, MTN MoMo, EcoCash, Airtel Money, Flutterwave
 * All credentials read from env vars — no hardcoded keys.
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { BillingService } from './billing.service';
import { MobileMoneyConfig } from '../entities/mobile-money-config.entity';
import { MobileMoneyTransaction } from '../entities/mobile-money-transaction.entity';

@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);

  constructor(
    private tenantService: TenantService,
    private billingService: BillingService,
  ) {}

  // ── Configs ───────────────────────────────────────────────────────────────

  async getConfigs(tenantId: string): Promise<MobileMoneyConfig[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MobileMoneyConfig).find({ where: { isActive: true } });
  }

  // ── Initiate ──────────────────────────────────────────────────────────────

  async initiate(tenantId: string, body: {
    invoiceId: string;
    patientId: string;
    provider: string;
    phoneNumber: string;
    amount: number;
    currency: string;
  }): Promise<MobileMoneyTransaction> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MobileMoneyTransaction);

    const tx = repo.create({
      invoiceId: body.invoiceId,
      patientId: body.patientId,
      provider: body.provider,
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      currency: body.currency,
      status: 'pending',
    });
    const saved = await repo.save(tx);

    // Dispatch to provider — fire-and-forget; callback will update status
    this._dispatchToProvider(saved, body.provider).catch((err) => {
      // Non-blocking: log and mark failed if dispatch itself throws
      this._markFailed(tenantId, saved.id, err?.message || 'Dispatch failed').catch((e: any) => { this.logger.warn(`Mobile money transaction failure mark failed: ${e?.message}`); });
    });

    return saved;
  }

  private async _dispatchToProvider(tx: MobileMoneyTransaction, provider: string): Promise<void> {
    switch (provider) {
      case 'mpesa':      return this._mpesaStkPush(tx);
      case 'mtn_momo':   return this._mtnRequestToPay(tx);
      case 'ecocash':    return this._ecocashMerchantPay(tx);
      case 'airtel':     return this._airtelInitiate(tx);
      case 'flutterwave': return this._flutterwaveCharge(tx);
      default:
        throw new BadRequestException(`Unknown mobile money provider: ${provider}`);
    }
  }

  // ── M-Pesa Daraja STK Push ────────────────────────────────────────────────

  private async _mpesaStkPush(tx: MobileMoneyTransaction): Promise<void> {
    const base = (process.env.MPESA_BASE_URL || '').replace(/\/$/, '');
    const key = process.env.MPESA_CONSUMER_KEY || '';
    const secret = process.env.MPESA_CONSUMER_SECRET || '';
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey = process.env.MPESA_PASSKEY || '';
    const callbackUrl = process.env.MPESA_CALLBACK_URL || '';

    // OAuth token
    const token64 = Buffer.from(`${key}:${secret}`).toString('base64');
    const authRes = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${token64}` },
    });
    const accessToken: string = authRes.data.access_token;

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkRes = await axios.post(
      `${base}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(tx.amount),
        PartyA: tx.phoneNumber,
        PartyB: shortcode,
        PhoneNumber: tx.phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: tx.invoiceId,
        TransactionDesc: 'Umoya Invoice Payment',
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    // Store CheckoutRequestID for status polling
    if (stkRes.data?.CheckoutRequestID) {
      Object.assign(tx, { checkoutRequestId: stkRes.data.CheckoutRequestID });
    }
  }

  // ── MTN MoMo ─────────────────────────────────────────────────────────────

  private async _mtnRequestToPay(tx: MobileMoneyTransaction): Promise<void> {
    const base = (process.env.MTN_BASE_URL || '').replace(/\/$/, '');
    const subKey = process.env.MTN_SUBSCRIPTION_KEY || '';
    const apiUser = process.env.MTN_API_USER || '';
    const apiKey = process.env.MTN_API_KEY || '';

    const token64 = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
    const tokenRes = await axios.post(
      `${base}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${token64}`,
          'Ocp-Apim-Subscription-Key': subKey,
        },
      },
    );
    const accessToken: string = tokenRes.data.access_token;

    const referenceId = tx.id;
    await axios.post(
      `${base}/collection/v1_0/requesttopay`,
      {
        amount: String(tx.amount),
        currency: tx.currency,
        externalId: tx.invoiceId,
        payer: { partyIdType: 'MSISDN', partyId: tx.phoneNumber },
        payerMessage: 'Umoya Invoice Payment',
        payeeNote: tx.invoiceId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': subKey,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  // ── EcoCash ───────────────────────────────────────────────────────────────

  private async _ecocashMerchantPay(tx: MobileMoneyTransaction): Promise<void> {
    const base = (process.env.ECOCASH_BASE_URL || '').replace(/\/$/, '');
    const merchantCode = process.env.ECOCASH_MERCHANT_CODE || '';
    const merchantPin = process.env.ECOCASH_MERCHANT_PIN || '';

    await axios.post(
      `${base}/transactions/merchant-payment`,
      {
        merchantCode,
        merchantPin,
        merchantNumber: merchantCode,
        transactionOperationStatus: 'Initiated',
        subscriberMsisdn: tx.phoneNumber,
        amount: tx.amount,
        currencyCode: tx.currency,
        clientCorrelator: tx.id,
        notifyUrl: process.env.ECOCASH_CALLBACK_URL || '',
        referenceCode: tx.invoiceId,
        transactionDescription: 'Umoya Invoice Payment',
      },
    );
  }

  // ── Airtel Money ──────────────────────────────────────────────────────────

  private async _airtelInitiate(tx: MobileMoneyTransaction): Promise<void> {
    const base = (process.env.AIRTEL_BASE_URL || '').replace(/\/$/, '');
    const clientId = process.env.AIRTEL_CLIENT_ID || '';
    const clientSecret = process.env.AIRTEL_CLIENT_SECRET || '';
    const country = process.env.AIRTEL_COUNTRY || 'ZM';
    const currency = process.env.AIRTEL_CURRENCY || tx.currency;

    // OAuth
    const tokenRes = await axios.post(`${base}/auth/oauth2/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });
    const accessToken: string = tokenRes.data.access_token;

    await axios.post(
      `${base}/merchant/v1/payments/`,
      {
        reference: tx.invoiceId,
        subscriber: { country, currency, msisdn: tx.phoneNumber },
        transaction: { amount: tx.amount, country, currency, id: tx.id },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Country': country,
          'X-Currency': currency,
        },
      },
    );
  }

  // ── Flutterwave ───────────────────────────────────────────────────────────

  private async _flutterwaveCharge(tx: MobileMoneyTransaction): Promise<void> {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    const countryCode = tx.currency.slice(0, 2).toLowerCase(); // e.g. KE, GH, ZM

    await axios.post(
      `https://api.flutterwave.com/v3/charges?type=mobile_money_${countryCode}`,
      {
        phone_number: tx.phoneNumber,
        amount: tx.amount,
        currency: tx.currency,
        email: 'patient@umoya.health',
        tx_ref: tx.id,
        fullname: 'Umoya Patient',
      },
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────

  async handleCallback(tenantId: string, provider: string, payload: any): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MobileMoneyTransaction);

    let txId: string | undefined;
    let success = false;
    let receiptNumber: string | undefined;
    let failureReason: string | undefined;
    let providerReference: string | undefined;

    switch (provider) {
      case 'mpesa': {
        // Daraja callback: Body.stkCallback
        const cb = payload?.Body?.stkCallback;
        txId = cb?.AccountReference; // we set AccountReference = invoiceId; look up by checkoutRequestId
        const checkoutId = cb?.CheckoutRequestID;
        if (checkoutId) {
          const row = await repo.findOne({ where: { checkoutRequestId: checkoutId } });
          if (row) txId = row.id;
        }
        success = cb?.ResultCode === 0;
        receiptNumber = cb?.CallbackMetadata?.Item?.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
        failureReason = success ? undefined : cb?.ResultDesc;
        providerReference = receiptNumber;
        break;
      }
      case 'mtn_momo': {
        // MTN sends referenceId as the transaction UUID we set as X-Reference-Id
        txId = payload?.externalId || payload?.referenceId;
        success = payload?.status === 'SUCCESSFUL';
        failureReason = success ? undefined : payload?.reason;
        providerReference = payload?.financialTransactionId;
        break;
      }
      case 'ecocash': {
        txId = payload?.clientCorrelator;
        success = payload?.transactionOperationStatus === 'Completed';
        failureReason = success ? undefined : payload?.description;
        providerReference = payload?.serverReferenceCode;
        break;
      }
      case 'airtel': {
        txId = payload?.transaction?.id;
        success = payload?.transaction?.status === 'TS';
        failureReason = success ? undefined : payload?.transaction?.message;
        providerReference = payload?.transaction?.airtel_money_id;
        break;
      }
      case 'flutterwave': {
        txId = payload?.data?.tx_ref;
        success = payload?.data?.status === 'successful';
        failureReason = success ? undefined : payload?.data?.processor_response;
        providerReference = String(payload?.data?.id ?? '');
        receiptNumber = providerReference;
        break;
      }
    }

    if (!txId) return;

    const tx = await repo.findOne({ where: { id: txId } });
    if (!tx) return;

    await repo.update(tx.id, {
      status: success ? 'success' : 'failed',
      completedAt: new Date(),
      receiptNumber: receiptNumber ?? null,
      providerReference: providerReference ?? null,
      failureReason: failureReason ?? null,
    });

    // Mark invoice paid when confirmed
    if (success) {
      const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
      await this.billingService.addPayment(
        tx.invoiceId,
        {
          amount: tx.amount,
          paymentMethod: 'mobile_money',
          paymentReference: receiptNumber || providerReference,
          note: `${provider.toUpperCase()} payment confirmed`,
        },
        tenantDb,
        'system',
      );
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  async getTransaction(tenantId: string, id: string): Promise<MobileMoneyTransaction | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MobileMoneyTransaction).findOne({ where: { id } });
  }

  async getByInvoice(tenantId: string, invoiceId: string): Promise<MobileMoneyTransaction[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MobileMoneyTransaction).find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async _markFailed(tenantId: string, txId: string, reason: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(MobileMoneyTransaction).update(txId, {
      status: 'failed',
      failureReason: reason,
      completedAt: new Date(),
    });
  }
}
