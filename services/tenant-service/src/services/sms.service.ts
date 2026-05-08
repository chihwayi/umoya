import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled = process.env.SMS_ENABLED === 'true';
  private readonly apiKey = process.env.AT_API_KEY ?? '';
  private readonly username = process.env.AT_USERNAME ?? 'sandbox';
  private readonly senderId = process.env.AT_SENDER_ID ?? '';

  async send(to: string | string[], message: string): Promise<void> {
    if (!this.enabled || !this.apiKey) {
      this.logger.log(`[SMS-SKIP] ${message.slice(0, 80)}`);
      return;
    }

    const recipients = Array.isArray(to) ? to.join(',') : to;
    const params = new URLSearchParams({
      username: this.username,
      to: recipients,
      message,
    });
    if (this.senderId) params.set('from', this.senderId);

    try {
      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        this.logger.error(`[SMS-FAIL] HTTP ${res.status}: ${await res.text()}`);
        return;
      }

      const data = await res.json() as any;
      const recipients_result = data?.SMSMessageData?.Recipients ?? [];
      const delivered = recipients_result.filter((r: any) => r.status === 'Success').length;
      this.logger.log(`[SMS-OK] ${delivered}/${recipients_result.length} delivered to ${recipients}`);
    } catch (err: any) {
      this.logger.error(`[SMS-ERR] ${err.message}`);
    }
  }
}
