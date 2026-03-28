import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { DataSource, Repository } from 'typeorm';
import { Bill, BillStatus } from '../entities/billing.entity';
import { PaymentGatewayConfig, PaymentProviderType } from '../entities/payment-gateway-config.entity';
import { PaymentProviderEvent } from '../entities/payment-provider-event.entity';
import { PaymentVerificationAttempt } from '../entities/payment-verification-attempt.entity';

type SupportedMobileMoneyProvider = PaymentProviderType.ECOCASH | PaymentProviderType.ONEMONEY;

type ProviderConfigField =
  | 'apiUrl'
  | 'merchantId'
  | 'integrationKey'
  | 'apiKey'
  | 'apiSecret'
  | 'webhookUrl';

type ProviderContractShape = {
  initiationPath: string;
  statusPath: string;
  requiredConfigFields: ProviderConfigField[];
  requestMapper: (
    config: PaymentGatewayConfig,
    payload: {
      transactionId: string;
      billId: string;
      amount: number;
      currency: string;
      phoneNumber: string;
      reference: string;
    },
  ) => Record<string, any>;
  statusParamsMapper: (
    config: PaymentGatewayConfig,
    latestEvent: PaymentProviderEvent,
    transactionId: string,
  ) => Record<string, any>;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  async processMobileMoneyPayment(paymentData: any, tenantDb: DataSource) {
    const provider = this.normalizeProvider(paymentData?.provider);
    if (!provider) {
      throw new BadRequestException('Unsupported payment provider');
    }

    const payload = {
      billId: paymentData?.billId,
      amount: Number(paymentData?.amount || 0),
      phoneNumber: String(paymentData?.phoneNumber || '').trim(),
      currency: String(paymentData?.currency || 'USD').trim().toUpperCase(),
    };

    switch (provider) {
      case PaymentProviderType.ECOCASH:
        return this.processEcoCashPayment(payload, tenantDb);
      case PaymentProviderType.ONEMONEY:
        return this.processOneMoneyPayment(payload, tenantDb);
      default:
        throw new BadRequestException('Unsupported payment provider');
    }
  }

  async processEcoCashPayment(paymentData: any, tenantDb: DataSource) {
    return this.processProviderPayment(
      PaymentProviderType.ECOCASH,
      {
        ...paymentData,
        instructionsBuilder: (amount: number) =>
          `Dial *151# and follow prompts to pay $${amount} to MediCore Clinic`,
        expiryMinutes: 15,
        feeCalculator: (amount: number) => this.calculateEcoCashFees(amount),
      },
      tenantDb,
    );
  }

  async processOneMoneyPayment(paymentData: any, tenantDb: DataSource) {
    return this.processProviderPayment(
      PaymentProviderType.ONEMONEY,
      {
        ...paymentData,
        instructionsBuilder: (amount: number) =>
          `You will receive an SMS prompt to authorize payment of $${amount} to MediCore Clinic`,
        expiryMinutes: 10,
        feeCalculator: (amount: number) => this.calculateOneMoneyFees(amount),
      },
      tenantDb,
    );
  }

  async getPaymentStatus(transactionId: string, tenantDb: DataSource) {
    let latestEvent = await this.getLatestProviderEvent(transactionId, tenantDb);
    if (!latestEvent) {
      throw new NotFoundException('Payment transaction not found');
    }

    if (this.mapPublicStatus(latestEvent.providerStatus) === 'PENDING') {
      latestEvent = (await this.refreshProviderStatus(transactionId, latestEvent, tenantDb)) || latestEvent;
    }

    const latestVerification = await this.getLatestVerificationAttempt(transactionId, tenantDb);
    const publicStatus = this.mapPublicStatus(latestEvent.providerStatus);
    const amount =
      this.extractNumericValue(latestEvent.responsePayload?.amount) ??
      this.extractNumericValue(latestEvent.requestPayload?.amount) ??
      null;
    const currency =
      String(
        latestEvent.responsePayload?.currency ||
          latestEvent.requestPayload?.currency ||
          'USD',
      ).toUpperCase();

    return {
      transactionId,
      provider: this.getProviderDisplayName(latestEvent.providerType),
      providerType: latestEvent.providerType,
      status: publicStatus,
      providerStatus: latestEvent.providerStatus || 'UNKNOWN',
      reference:
        latestEvent.reference ||
        latestEvent.responsePayload?.reference ||
        latestEvent.requestPayload?.reference ||
        null,
      amount,
      currency,
      billId: latestEvent.billId || null,
      verification: latestVerification
        ? {
            outcome: latestVerification.outcome,
            reason: latestVerification.reason || null,
            attemptedAt: latestVerification.attemptedAt,
          }
        : null,
      completedAt:
        publicStatus === 'COMPLETED' ? latestEvent.eventTimestamp?.toISOString?.() || latestEvent.eventTimestamp : null,
      failureReason:
        publicStatus === 'FAILED' || publicStatus === 'EXPIRED'
          ? String(
              latestEvent.responsePayload?.reason ||
                latestEvent.responsePayload?.message ||
                latestEvent.providerStatus ||
                'Payment failed',
            )
          : null,
      latestEventType: latestEvent.eventType,
      latestEventAt: latestEvent.eventTimestamp,
    };
  }

  async verifyPayment(transactionId: string, reference: string | undefined, tenantDb: DataSource) {
    let latestEvent = await this.getLatestProviderEvent(transactionId, tenantDb);
    if (!latestEvent) {
      await this.recordVerificationAttempt(tenantDb, {
        transactionId,
        providerType: this.inferProviderFromTransactionId(transactionId),
        reference: reference || null,
        outcome: 'transaction_not_found',
        reason: 'Transaction not found in provider event log.',
        responsePayload: {
          status: 'VERIFICATION_FAILED',
        },
      });

      return {
        verified: false,
        transactionId,
        reference,
        status: 'VERIFICATION_FAILED',
        reason: 'Transaction not found or invalid',
      };
    }

    if (this.mapPublicStatus(latestEvent.providerStatus) === 'PENDING') {
      latestEvent = (await this.refreshProviderStatus(transactionId, latestEvent, tenantDb)) || latestEvent;
    }

    const publicStatus = this.mapPublicStatus(latestEvent.providerStatus);
    const resolvedReference =
      reference ||
      latestEvent.reference ||
      latestEvent.responsePayload?.reference ||
      latestEvent.requestPayload?.reference ||
      null;

    if (publicStatus === 'COMPLETED') {
      if (latestEvent.billId) {
        await this.markBillPaid(latestEvent.billId, resolvedReference, latestEvent.providerType, tenantDb);
      }

      await this.recordVerificationAttempt(tenantDb, {
        transactionId,
        providerType: latestEvent.providerType,
        reference: resolvedReference,
        outcome: 'verified',
        reason: null,
        responsePayload: {
          providerStatus: latestEvent.providerStatus,
          status: 'VERIFIED',
        },
      });

      return {
        verified: true,
        transactionId,
        reference: resolvedReference,
        status: 'VERIFIED',
        providerStatus: latestEvent.providerStatus,
        amount:
          this.extractNumericValue(latestEvent.responsePayload?.amount) ??
          this.extractNumericValue(latestEvent.requestPayload?.amount) ??
          null,
        currency: String(
          latestEvent.responsePayload?.currency ||
            latestEvent.requestPayload?.currency ||
            'USD',
        ).toUpperCase(),
        verifiedAt: new Date().toISOString(),
      };
    }

    const reason =
      publicStatus === 'PENDING'
        ? 'Provider confirmation is still pending.'
        : publicStatus === 'CONFIGURATION_REQUIRED'
          ? 'Payment gateway configuration is incomplete for this tenant.'
          : 'Provider did not confirm a successful payment.';

    await this.recordVerificationAttempt(tenantDb, {
      transactionId,
      providerType: latestEvent.providerType,
      reference: resolvedReference,
      outcome:
        publicStatus === 'PENDING'
          ? 'pending_provider_confirmation'
          : publicStatus === 'FAILED'
            ? 'provider_lookup_failed'
            : 'verification_failed',
      reason,
      responsePayload: {
        providerStatus: latestEvent.providerStatus,
        status: publicStatus,
      },
    });

    return {
      verified: false,
      transactionId,
      reference: resolvedReference,
      status: publicStatus === 'PENDING' ? 'PENDING_PROVIDER_CONFIRMATION' : 'VERIFICATION_FAILED',
      providerStatus: latestEvent.providerStatus,
      reason,
    };
  }

  async recordProviderCallback(callbackData: any, tenantDb: DataSource) {
    const transactionId = String(callbackData?.transactionId || callbackData?.transaction_id || '').trim();
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    const latestEvent = await this.getLatestProviderEvent(transactionId, tenantDb);
    const providerType =
      this.normalizeProvider(callbackData?.provider || callbackData?.providerType || callbackData?.provider_type) ||
      latestEvent?.providerType ||
      this.inferProviderFromTransactionId(transactionId);
    const providerStatus = this.mapProviderStatus(
      callbackData?.status || callbackData?.providerStatus || callbackData?.provider_status || callbackData?.result,
    );
    const reference =
      String(callbackData?.reference || callbackData?.paymentReference || latestEvent?.reference || '').trim() || null;
    const correlationId =
      String(callbackData?.correlationId || callbackData?.correlation_id || '').trim() || null;
    const billId =
      String(callbackData?.billId || callbackData?.bill_id || latestEvent?.billId || '').trim() || null;

    await this.recordProviderEvent(tenantDb, {
      transactionId,
      billId,
      providerType,
      eventType: 'provider_callback',
      providerStatus,
      reference,
      correlationId,
      requestPayload: {},
      responsePayload: callbackData || {},
    });

    if (providerStatus === 'COMPLETED' && billId) {
      await this.markBillPaid(billId, reference, providerType, tenantDb);
    } else if (billId) {
      await this.markBillPending(billId, reference, providerType, tenantDb);
    }

    return this.getPaymentStatus(transactionId, tenantDb);
  }

  async getPaymentMethods() {
    return {
      mobileMoney: [
        {
          provider: 'EcoCash',
          name: 'EcoCash',
          logo: '/images/ecocash-logo.png',
          supported: true,
          currencies: ['USD', 'ZWL'],
          fees: {
            percentage: 2.5,
            minimum: 0.10,
            maximum: 5.00,
          },
          limits: {
            minimum: 1.00,
            maximum: 1000.00,
            daily: 5000.00,
          },
        },
        {
          provider: 'OneMoney',
          name: 'OneMoney',
          logo: '/images/onemoney-logo.png',
          supported: true,
          currencies: ['USD', 'ZWL'],
          fees: {
            percentage: 2.0,
            minimum: 0.05,
            maximum: 3.00,
          },
          limits: {
            minimum: 1.00,
            maximum: 500.00,
            daily: 2000.00,
          },
        },
      ],
      traditional: [
        {
          method: 'cash',
          name: 'Cash Payment',
          supported: true,
          currencies: ['USD', 'ZWL'],
        },
        {
          method: 'bank_transfer',
          name: 'Bank Transfer',
          supported: true,
          currencies: ['USD', 'ZWL'],
        },
      ],
    };
  }

  private async processProviderPayment(
    providerType: SupportedMobileMoneyProvider,
    paymentData: {
      billId: string;
      amount: number;
      phoneNumber: string;
      currency?: string;
      expiryMinutes: number;
      feeCalculator: (amount: number) => number;
      instructionsBuilder: (amount: number) => string;
    },
    tenantDb: DataSource,
  ) {
    if (!paymentData.billId) {
      throw new BadRequestException('billId is required');
    }
    if (!(paymentData.amount > 0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (!paymentData.phoneNumber) {
      throw new BadRequestException('Phone number is required for mobile money payments');
    }

    const bill = await this.getBillRepository(tenantDb).findOne({ where: { id: paymentData.billId } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const transactionId = this.buildTransactionId(providerType);
    const reference = `REF_${transactionId}`;
    const expiresAt = new Date(Date.now() + paymentData.expiryMinutes * 60 * 1000).toISOString();
    const currency = String(paymentData.currency || 'USD').trim().toUpperCase();
    const config = await this.loadProviderConfig(providerType, tenantDb);
    const fees = paymentData.feeCalculator(paymentData.amount);
    const responseBase = {
      transactionId,
      status: 'PENDING',
      provider: this.getProviderDisplayName(providerType),
      providerType,
      merchantId: config?.merchantId || null,
      amount: paymentData.amount,
      currency,
      phoneNumber: paymentData.phoneNumber,
      reference,
      expiresAt,
      fees,
      timestamp: new Date().toISOString(),
      billId: bill.id,
    };

    const contract = config ? this.getProviderContract(providerType, config) : null;
    const missingConfiguration = contract ? this.getMissingProviderConfig(contract, config) : ['apiUrl', 'merchantId'];

    if (!config || missingConfiguration.length > 0) {
      await this.recordProviderEvent(tenantDb, {
        transactionId,
        billId: bill.id,
        providerType,
        eventType: 'initiation_failed',
        providerStatus: 'CONFIGURATION_ERROR',
        reference,
        correlationId: null,
        requestPayload: {
          amount: paymentData.amount,
          billId: bill.id,
          currency,
          phoneNumber: paymentData.phoneNumber,
        },
        responsePayload: {
          error: 'Payment gateway configuration incomplete.',
          missingConfiguration: {
            hasActiveConfig: Boolean(config),
            hasApiUrl: Boolean(config?.apiUrl),
            hasMerchantId: Boolean(config?.merchantId),
            missingFields: missingConfiguration,
          },
        },
      });
      await this.markBillPending(bill.id, reference, providerType, tenantDb);

      return {
        ...responseBase,
        status: 'CONFIGURATION_REQUIRED',
        instructions: 'Payment gateway configuration is incomplete for this tenant.',
        pendingProviderConfirmation: false,
        requiresConfiguration: true,
      };
    }

    const providerInitiation = await this.initiateProviderPayment(
      providerType,
      config,
      contract!,
      {
        amount: paymentData.amount,
        billId: bill.id,
        currency,
        phoneNumber: paymentData.phoneNumber,
        reference,
        transactionId,
      },
      tenantDb,
    );

    if (!providerInitiation.ok) {
      await this.markBillPending(bill.id, reference, providerType, tenantDb);

      return {
        ...responseBase,
        status: 'PROVIDER_UNAVAILABLE',
        instructions: 'Payment provider initiation failed. Retry once connectivity or credentials are fixed.',
        pendingProviderConfirmation: false,
        requiresConfiguration: false,
        requiresRetry: true,
      };
    }

    const providerStatus = this.mapProviderStatus(providerInitiation.response?.status || 'PENDING_PROVIDER_CONFIRMATION');
    const publicStatus = this.mapPublicStatus(providerStatus);
    const resolvedReference =
      String(providerInitiation.response?.reference || providerInitiation.response?.paymentReference || reference).trim() ||
      reference;
    const correlationId =
      String(providerInitiation.response?.correlationId || providerInitiation.response?.correlation_id || '').trim() ||
      null;

    await this.recordProviderEvent(tenantDb, {
      transactionId,
      billId: bill.id,
      providerType,
      eventType: 'payment_initiated',
      providerStatus,
      reference: resolvedReference,
      correlationId,
      requestPayload: {
        amount: paymentData.amount,
        billId: bill.id,
        currency,
        phoneNumber: paymentData.phoneNumber,
        providerRequestUrl: providerInitiation.requestUrl,
      },
      responsePayload: providerInitiation.response,
    });

    if (publicStatus === 'COMPLETED') {
      await this.markBillPaid(bill.id, resolvedReference, providerType, tenantDb);
    } else {
      await this.markBillPending(bill.id, resolvedReference, providerType, tenantDb);
    }

    return {
      ...responseBase,
      status: publicStatus,
      reference: resolvedReference,
      instructions:
        providerInitiation.response?.instructions || paymentData.instructionsBuilder(paymentData.amount),
      pendingProviderConfirmation: publicStatus === 'PENDING',
      requiresConfiguration: false,
      providerStatus,
      providerCorrelationId: correlationId,
    };
  }

  private normalizeProvider(value: any): SupportedMobileMoneyProvider | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PaymentProviderType.ECOCASH) {
      return PaymentProviderType.ECOCASH;
    }
    if (normalized === PaymentProviderType.ONEMONEY) {
      return PaymentProviderType.ONEMONEY;
    }
    return null;
  }

  private inferProviderFromTransactionId(transactionId: string): SupportedMobileMoneyProvider | null {
    if (transactionId.startsWith('ECO_')) {
      return PaymentProviderType.ECOCASH;
    }
    if (transactionId.startsWith('ONE_')) {
      return PaymentProviderType.ONEMONEY;
    }
    return null;
  }

  private buildTransactionId(providerType: SupportedMobileMoneyProvider) {
    const prefix = providerType === PaymentProviderType.ECOCASH ? 'ECO' : 'ONE';
    return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private getProviderDisplayName(providerType: string | null | undefined) {
    if (providerType === PaymentProviderType.ECOCASH) {
      return 'EcoCash';
    }
    if (providerType === PaymentProviderType.ONEMONEY) {
      return 'OneMoney';
    }
    return 'Unknown';
  }

  private mapProviderStatus(rawStatus: any): string {
    const value = String(rawStatus || '').trim().toUpperCase();
    if (!value) {
      return 'PENDING_PROVIDER_CONFIRMATION';
    }
    if (
      value.includes('COMPLETE') ||
      value.includes('SUCCESS') ||
      value.includes('PAID') ||
      value.includes('VERIFIED')
    ) {
      return 'COMPLETED';
    }
    if (
      value.includes('FAIL') ||
      value.includes('DECLIN') ||
      value.includes('REJECT') ||
      value.includes('ERROR') ||
      value.includes('CANCEL')
    ) {
      return 'FAILED';
    }
    if (value.includes('EXPIRE') || value.includes('TIMEOUT')) {
      return 'EXPIRED';
    }
    if (value.includes('CONFIG')) {
      return 'CONFIGURATION_ERROR';
    }
    if (value.includes('UNAVAILABLE') || value.includes('LOOKUP')) {
      return 'FAILED';
    }
    if (value.includes('PENDING') || value.includes('AWAIT') || value.includes('QUEUE')) {
      return 'PENDING_PROVIDER_CONFIRMATION';
    }
    return value;
  }

  private mapPublicStatus(providerStatus: string | null | undefined) {
    const normalized = this.mapProviderStatus(providerStatus);
    if (normalized === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (normalized === 'FAILED') {
      return 'FAILED';
    }
    if (normalized === 'EXPIRED') {
      return 'EXPIRED';
    }
    if (normalized === 'CONFIGURATION_ERROR') {
      return 'CONFIGURATION_REQUIRED';
    }
    if (normalized === 'PENDING_PROVIDER_CONFIRMATION') {
      return 'PENDING';
    }
    return normalized || 'UNKNOWN';
  }

  private async loadProviderConfig(
    providerType: SupportedMobileMoneyProvider,
    tenantDb: DataSource,
  ): Promise<PaymentGatewayConfig | null> {
    try {
      return await tenantDb.getRepository(PaymentGatewayConfig).findOne({
        where: {
          providerType,
          isActive: true,
        },
        order: {
          updatedAt: 'DESC',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to load payment config for ${providerType}`, error as Error);
      return null;
    }
  }

  private async getLatestProviderEvent(transactionId: string, tenantDb: DataSource) {
    return tenantDb.getRepository(PaymentProviderEvent).findOne({
      where: { transactionId },
      order: {
        eventTimestamp: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  private async getLatestVerificationAttempt(transactionId: string, tenantDb: DataSource) {
    return tenantDb.getRepository(PaymentVerificationAttempt).findOne({
      where: { transactionId },
      order: {
        attemptedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  private async recordProviderEvent(
    tenantDb: DataSource,
    payload: {
      transactionId: string;
      billId?: string | null;
      providerType: string | null;
      eventType: string;
      providerStatus?: string | null;
      reference?: string | null;
      correlationId?: string | null;
      requestPayload?: Record<string, any>;
      responsePayload?: Record<string, any>;
    },
  ) {
    const repository = tenantDb.getRepository(PaymentProviderEvent);
    return repository.save(
      repository.create({
        billId: payload.billId || null,
        correlationId: payload.correlationId || null,
        eventType: payload.eventType,
        providerStatus: payload.providerStatus || null,
        providerType: payload.providerType || 'unknown',
        reference: payload.reference || null,
        requestPayload: payload.requestPayload || {},
        responsePayload: payload.responsePayload || {},
        transactionId: payload.transactionId,
      }),
    );
  }

  private async recordVerificationAttempt(
    tenantDb: DataSource,
    payload: {
      transactionId: string;
      providerType?: string | null;
      reference?: string | null;
      outcome: string;
      reason?: string | null;
      responsePayload?: Record<string, any>;
    },
  ) {
    const repository = tenantDb.getRepository(PaymentVerificationAttempt);
    return repository.save(
      repository.create({
        outcome: payload.outcome,
        providerType: payload.providerType || null,
        reason: payload.reason || null,
        reference: payload.reference || null,
        responsePayload: payload.responsePayload || {},
        transactionId: payload.transactionId,
      }),
    );
  }

  private async initiateProviderPayment(
    providerType: SupportedMobileMoneyProvider,
    config: PaymentGatewayConfig,
    contract: ProviderContractShape,
    payload: {
      transactionId: string;
      billId: string;
      amount: number;
      currency: string;
      phoneNumber: string;
      reference: string;
    },
    tenantDb: DataSource,
  ) {
    const requestUrl = this.buildProviderUrl(
      config.apiUrl,
      contract.initiationPath,
    );

    try {
      const response = await axios.post(
        requestUrl,
        contract.requestMapper(config, payload),
        {
          timeout: Number(config.metadata?.timeoutMs || 12000),
          headers: this.buildProviderHeaders(config),
        },
      );

      return {
        ok: true,
        requestUrl,
        response: response.data || {},
      };
    } catch (error: any) {
      await this.recordProviderEvent(tenantDb, {
        transactionId: payload.transactionId,
        billId: payload.billId,
        providerType,
        eventType: 'initiation_failed',
        providerStatus: 'FAILED',
        reference: payload.reference,
        correlationId: null,
        requestPayload: {
          amount: payload.amount,
          billId: payload.billId,
          currency: payload.currency,
          phoneNumber: payload.phoneNumber,
          providerRequestUrl: requestUrl,
        },
        responsePayload: {
          error: error?.message || 'Provider initiation failed',
          status: error?.response?.status || null,
          data: error?.response?.data || null,
        },
      });

      this.logger.warn(`Payment initiation failed for ${providerType} transaction ${payload.transactionId}`, error);

      return {
        ok: false,
        requestUrl,
        response: null,
      };
    }
  }

  private async refreshProviderStatus(
    transactionId: string,
    latestEvent: PaymentProviderEvent,
    tenantDb: DataSource,
  ) {
    if (!latestEvent.providerType) {
      return null;
    }

    const providerType = this.normalizeProvider(latestEvent.providerType);
    if (!providerType) {
      return null;
    }

    const config = await this.loadProviderConfig(providerType, tenantDb);
    if (!config) {
      return null;
    }

    const contract = this.getProviderContract(providerType, config);
    const missingConfiguration = this.getMissingProviderConfig(contract, config);
    if (missingConfiguration.length > 0) {
      return null;
    }

    const requestUrl = this.buildProviderUrl(
      config.apiUrl,
      contract.statusPath,
    );

    try {
      const response = await axios.get(requestUrl, {
        timeout: Number(config.metadata?.timeoutMs || 12000),
        headers: this.buildProviderHeaders(config),
        params: contract.statusParamsMapper(config, latestEvent, transactionId),
      });

      const providerStatus = this.mapProviderStatus(
        response.data?.status ||
          response.data?.providerStatus ||
          response.data?.result ||
          'PENDING_PROVIDER_CONFIRMATION',
      );

      const refreshedEvent = await this.recordProviderEvent(tenantDb, {
        transactionId,
        billId: latestEvent.billId || null,
        providerType,
        eventType: 'status_refresh',
        providerStatus,
        reference:
          String(response.data?.reference || response.data?.paymentReference || latestEvent.reference || '').trim() ||
          latestEvent.reference,
        correlationId:
          String(response.data?.correlationId || response.data?.correlation_id || latestEvent.correlationId || '').trim() ||
          latestEvent.correlationId,
        requestPayload: {
          providerRequestUrl: requestUrl,
        },
        responsePayload: response.data || {},
      });

      if (providerStatus === 'COMPLETED' && latestEvent.billId) {
        await this.markBillPaid(
          latestEvent.billId,
          refreshedEvent.reference || latestEvent.reference || null,
          providerType,
          tenantDb,
        );
      }

      return refreshedEvent;
    } catch (error: any) {
      await this.recordVerificationAttempt(tenantDb, {
        transactionId,
        providerType,
        reference: latestEvent.reference || null,
        outcome: 'provider_lookup_failed',
        reason: error?.message || 'Provider status lookup failed',
        responsePayload: {
          status: error?.response?.status || null,
          data: error?.response?.data || null,
          providerRequestUrl: requestUrl,
        },
      });

      this.logger.warn(`Payment status refresh failed for ${transactionId}`, error);
      return null;
    }
  }

  private buildProviderUrl(baseUrl: string, path: string) {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) {
      return normalizedBase;
    }
    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }
    return `${normalizedBase}/${normalizedPath.replace(/^\/+/, '')}`;
  }

  private buildProviderHeaders(config: PaymentGatewayConfig) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
    if (config.integrationKey) {
      headers['x-integration-key'] = config.integrationKey;
    }
    if (config.apiSecret) {
      headers.authorization = `Bearer ${config.apiSecret}`;
    }
    if (config.webhookSecret) {
      headers['x-webhook-secret'] = config.webhookSecret;
    }

    return headers;
  }

  private getProviderContract(
    providerType: SupportedMobileMoneyProvider,
    config: PaymentGatewayConfig,
  ): ProviderContractShape {
    const metadata = config.metadata || {};
    if (providerType === PaymentProviderType.ECOCASH) {
      return {
        initiationPath: String(metadata.initiationPath || '/payments/initiate'),
        statusPath: String(metadata.statusPath || '/payments/status'),
        requiredConfigFields: ['apiUrl', 'merchantId', 'integrationKey'],
        requestMapper: (providerConfig, payload) => ({
          merchantId: providerConfig.merchantId,
          integrationKey: providerConfig.integrationKey,
          transactionId: payload.transactionId,
          billId: payload.billId,
          amount: payload.amount,
          currency: payload.currency,
          msisdn: payload.phoneNumber,
          phoneNumber: payload.phoneNumber,
          reference: payload.reference,
          callbackUrl: providerConfig.webhookUrl || null,
          providerType: PaymentProviderType.ECOCASH,
          testMode: Boolean(providerConfig.isTestMode),
        }),
        statusParamsMapper: (providerConfig, latestEvent, transactionId) => ({
          merchantId: providerConfig.merchantId,
          integrationKey: providerConfig.integrationKey,
          transactionId,
          reference:
            latestEvent.reference ||
            latestEvent.responsePayload?.reference ||
            latestEvent.requestPayload?.reference ||
            null,
        }),
      };
    }

    return {
      initiationPath: String(metadata.initiationPath || '/payments/initiate'),
      statusPath: String(metadata.statusPath || '/payments/status'),
      requiredConfigFields: ['apiUrl', 'merchantId', 'apiKey'],
      requestMapper: (providerConfig, payload) => ({
        merchantId: providerConfig.merchantId,
        apiKey: providerConfig.apiKey,
        transactionId: payload.transactionId,
        billId: payload.billId,
        amount: payload.amount,
        currency: payload.currency,
        customerPhone: payload.phoneNumber,
        phoneNumber: payload.phoneNumber,
        reference: payload.reference,
        callbackUrl: providerConfig.webhookUrl || null,
        providerType: PaymentProviderType.ONEMONEY,
        testMode: Boolean(providerConfig.isTestMode),
      }),
      statusParamsMapper: (providerConfig, latestEvent, transactionId) => ({
        merchantId: providerConfig.merchantId,
        apiKey: providerConfig.apiKey,
        transactionId,
        reference:
          latestEvent.reference ||
          latestEvent.responsePayload?.reference ||
          latestEvent.requestPayload?.reference ||
          null,
      }),
    };
  }

  private getMissingProviderConfig(contract: ProviderContractShape, config: PaymentGatewayConfig | null) {
    if (!config) {
      return contract.requiredConfigFields;
    }

    return contract.requiredConfigFields.filter((field) => {
      const value = config[field];
      return value === null || value === undefined || String(value).trim() === '';
    });
  }

  private async markBillPending(
    billId: string,
    reference: string | null,
    providerType: string | null,
    tenantDb: DataSource,
  ) {
    await tenantDb.query(
      `
        UPDATE billing
        SET status = $1,
            payment_reference = COALESCE($2, payment_reference),
            payment_method = COALESCE($3, payment_method),
            updated_at = NOW()
        WHERE id = $4
      `,
      [BillStatus.PENDING, reference, providerType || 'mobile_money', billId],
    );
  }

  private async markBillPaid(
    billId: string,
    reference: string | null,
    providerType: string | null,
    tenantDb: DataSource,
  ) {
    await tenantDb.query(
      `
        UPDATE billing
        SET status = $1,
            payment_reference = COALESCE($2, payment_reference),
            payment_method = COALESCE($3, payment_method),
            updated_at = NOW()
        WHERE id = $4
      `,
      [BillStatus.PAID, reference, providerType || 'mobile_money', billId],
    );
  }

  private getBillRepository(tenantDb: DataSource): Repository<Bill> {
    return tenantDb.getRepository(Bill);
  }

  private extractNumericValue(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private calculateEcoCashFees(amount: number): number {
    const percentage = 0.025;
    const fee = amount * percentage;
    return Math.max(0.10, Math.min(fee, 5.0));
  }

  private calculateOneMoneyFees(amount: number): number {
    const percentage = 0.02;
    const fee = amount * percentage;
    return Math.max(0.05, Math.min(fee, 3.0));
  }
}
