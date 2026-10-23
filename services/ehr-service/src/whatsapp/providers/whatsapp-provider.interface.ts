/**
 * Ported from the sibling Aurelia Commerce OS project's proven WhatsApp
 * integration (apps/api/src/whatsapp/providers/*). Same adapter shape, Meta
 * Cloud API only for v1 (S281 scope) — Twilio can be added later behind this
 * same interface if a tenant needs it.
 */

export interface InboundWhatsappMessage {
  /** The identifier this message arrived on — Meta's phone_number_id. */
  externalId: string;
  /** Patient's number, as the provider sent it. */
  from: string;
  text: string;
  /** Full provider-native message object, kept for anything downstream that needs it. */
  raw: unknown;
  /** Meta's wamid — used as a dedup key. */
  providerMessageId?: string;
}

export interface WhatsappSendResult {
  dryRun: boolean;
  providerMessageId?: string;
}

export interface WhatsappProviderAdapter {
  /** GET handshake — Meta needs this (hub.challenge echo). */
  verifyHandshake(query: Record<string, string>): string | null;
  /**
   * Throws (UnauthorizedException) on an invalid/missing signature.
   * `rawBody` must be the untouched request bytes, not a re-stringified
   * parsed body — HMAC verification requires byte-for-byte equality with
   * what Meta actually signed.
   */
  verifyInboundSignature(req: { headers: Record<string, unknown>; rawBody?: Buffer }): void;
  /** Parses Meta's native webhook body into zero or more normalized messages (status callbacks yield none). */
  parseInboundWebhook(payload: unknown): InboundWhatsappMessage[];
  sendText(to: string, body: string): Promise<WhatsappSendResult>;
  sendTemplate(to: string, template: { name: string; language: string; params: string[] }): Promise<WhatsappSendResult>;
}
