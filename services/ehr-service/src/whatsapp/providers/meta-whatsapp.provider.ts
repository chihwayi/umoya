import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  InboundWhatsappMessage,
  WhatsappProviderAdapter,
  WhatsappSendResult,
} from './whatsapp-provider.interface';

export interface MetaWhatsappCredentials {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  apiVersion?: string;
}

/**
 * Wraps Meta's WhatsApp Cloud API. HMAC signature verification logic ported
 * byte-for-byte from the Aurelia Commerce OS project's proven
 * meta-whatsapp.provider.ts (same crypto, same timing-safe comparison) —
 * not reimplemented, since webhook signature verification is exactly the
 * kind of code you port from a working reference rather than rewrite.
 */
export class MetaWhatsappProvider implements WhatsappProviderAdapter {
  constructor(private readonly creds: MetaWhatsappCredentials) {}

  private get apiVersion() {
    return this.creds.apiVersion || 'v21.0';
  }

  verifyHandshake(query: Record<string, string>): string | null {
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === this.creds.verifyToken) {
      return query['hub.challenge'];
    }
    return null;
  }

  verifyInboundSignature(req: { headers: Record<string, unknown>; rawBody?: Buffer }): void {
    const secret = this.creds.appSecret;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Webhook secret not configured');
      return; // local dev
    }
    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string' || !req.rawBody) throw new UnauthorizedException();
    const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(req.rawBody).digest('hex'));
    const given = Buffer.from(header);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
  }

  parseInboundWebhook(payload: unknown): InboundWhatsappMessage[] {
    const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const externalId: string | undefined = value?.metadata?.phone_number_id;
    if (!message?.from || !externalId) return []; // status callbacks etc.
    return [
      {
        externalId,
        from: message.from,
        text: message.text?.body ?? '',
        raw: message,
        providerMessageId: typeof message.id === 'string' ? message.id : undefined,
      },
    ];
  }

  async sendText(to: string, body: string): Promise<WhatsappSendResult> {
    return this.post({ messaging_product: 'whatsapp', to, type: 'text', text: { body } });
  }

  async sendTemplate(
    to: string,
    template: { name: string; language: string; params: string[] },
  ): Promise<WhatsappSendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        // A template with no variables must omit `components` entirely — an empty body component is rejected.
        ...(template.params.length > 0
          ? { components: [{ type: 'body', parameters: template.params.map((text) => ({ type: 'text', text })) }] }
          : {}),
      },
    });
  }

  private async post(body: Record<string, unknown>): Promise<WhatsappSendResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.creds.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Meta WhatsApp send failed (${response.status}): ${text}`);
    }
    const data = (await response.json().catch(() => ({}))) as any;
    const providerMessageId = data?.messages?.[0]?.id;
    return { dryRun: false, providerMessageId };
  }
}
