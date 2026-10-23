import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from '../services/tenant.service';
import { AtMessageLog } from '../entities/at-message-log.entity';
import { Patient } from '../entities/patient.entity';
import { WhatsappChannelConfig } from './entities/whatsapp-channel-config.entity';
import { WhatsappConsent } from './entities/whatsapp-consent.entity';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import type { WhatsappProviderAdapter } from './providers/whatsapp-provider.interface';

export interface WhatsappSendOutcome {
  success: boolean;
  skippedReason?: 'not_configured' | 'not_consented' | 'no_phone';
  providerMessageId?: string;
  error?: string;
}

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getAdapter(tenantDb: DataSource): Promise<WhatsappProviderAdapter | null> {
    const configRepo = tenantDb.getRepository(WhatsappChannelConfig);
    const config = await configRepo.findOne({ where: { isActive: true } });
    if (!config) return null;
    return new MetaWhatsappProvider({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      appSecret: config.appSecret,
      verifyToken: config.webhookVerifyToken,
      apiVersion: config.apiVersion,
    });
  }

  /**
   * Looks up the channel config directly — the public webhook controller
   * resolves `tenantSlug` from the URL (not from X-Tenant-ID, which Meta
   * cannot send) and needs the adapter before it can verify the inbound
   * signature, so it calls this rather than going through sendText/sendTemplate.
   */
  async getAdapterForTenant(tenantSlug: string): Promise<WhatsappProviderAdapter | null> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    if (!tenantDb) return null;
    return this.getAdapter(tenantDb);
  }

  /**
   * PHI-safe: callers must pass a generic body (no diagnoses, medication
   * names, or test results) — this method does not know or enforce content,
   * the discipline lives in the call sites in NotificationsService. Checks
   * per-patient consent before sending; does not throw on "not consented" —
   * that's an expected, common outcome, not an error.
   */
  async sendToPatient(
    tenantDb: DataSource,
    patientId: string,
    phoneNumber: string,
    body: string,
    messageType: string,
  ): Promise<WhatsappSendOutcome> {
    if (!phoneNumber) return { success: false, skippedReason: 'no_phone' };

    const consentRepo = tenantDb.getRepository(WhatsappConsent);
    const consent = await consentRepo.findOne({ where: { patientId } });
    if (!consent?.optedIn) {
      return { success: false, skippedReason: 'not_consented' };
    }

    const adapter = await this.getAdapter(tenantDb);
    if (!adapter) return { success: false, skippedReason: 'not_configured' };

    const logRepo = tenantDb.getRepository(AtMessageLog);
    try {
      const result = await adapter.sendText(phoneNumber, body);
      await logRepo.save(
        logRepo.create({
          patientId,
          channel: 'whatsapp',
          direction: 'outbound',
          phoneNumber,
          messageText: body,
          messageType,
          status: 'sent',
          atMessageId: result.providerMessageId ?? null,
        }),
      );
      return { success: true, providerMessageId: result.providerMessageId };
    } catch (err: any) {
      const message = err?.message ?? 'Unknown error';
      this.logger.error(`WhatsApp send failed for patient ${patientId}: ${message}`);
      await logRepo.save(
        logRepo.create({
          patientId,
          channel: 'whatsapp',
          direction: 'outbound',
          phoneNumber,
          messageText: body,
          messageType,
          status: 'failed',
          failureReason: message,
        }),
      );
      return { success: false, error: message };
    }
  }

  /** Inbound: verify signature, parse, log, and best-effort-match to a patient by phone number. */
  async handleInboundWebhook(
    tenantDb: DataSource,
    adapter: WhatsappProviderAdapter,
    req: { headers: Record<string, unknown>; rawBody?: Buffer; body: unknown },
  ): Promise<void> {
    adapter.verifyInboundSignature({ headers: req.headers, rawBody: req.rawBody });
    const messages = adapter.parseInboundWebhook(req.body);
    if (messages.length === 0) return; // status callbacks etc.

    const logRepo = tenantDb.getRepository(AtMessageLog);
    const patientRepo = tenantDb.getRepository(Patient);

    for (const message of messages) {
      const patient = await patientRepo.findOne({ where: { phone: message.from } });
      await logRepo.save(
        logRepo.create({
          patientId: patient?.id ?? null,
          channel: 'whatsapp',
          direction: 'inbound',
          phoneNumber: message.from,
          messageText: message.text,
          messageType: 'patient_message',
          status: 'received',
          atMessageId: message.providerMessageId ?? null,
        }),
      );
    }
  }

  async getConsent(tenantDb: DataSource, patientId: string): Promise<WhatsappConsent | null> {
    return tenantDb.getRepository(WhatsappConsent).findOne({ where: { patientId } });
  }

  async setConsent(
    tenantDb: DataSource,
    patientId: string,
    phoneNumber: string,
    optedIn: boolean,
  ): Promise<WhatsappConsent> {
    const repo = tenantDb.getRepository(WhatsappConsent);
    let consent = await repo.findOne({ where: { patientId } });
    const now = new Date();
    if (!consent) {
      consent = repo.create({ patientId, phoneNumber, optedIn, optedInAt: optedIn ? now : null });
    } else {
      consent.phoneNumber = phoneNumber;
      consent.optedIn = optedIn;
      if (optedIn) consent.optedInAt = now;
      else consent.optedOutAt = now;
    }
    return repo.save(consent);
  }
}
