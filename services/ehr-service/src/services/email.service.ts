import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Support multiple email providers via environment variables
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPassword = process.env.SMTP_PASSWORD || '';
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    // For SendGrid
    if (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      this.transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });
    }
    // For AWS SES
    else if (emailProvider === 'ses') {
      this.transporter = nodemailer.createTransport({
        host: process.env.SES_HOST || 'email-smtp.us-east-1.amazonaws.com',
        port: parseInt(process.env.SES_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SES_USER || smtpUser,
          pass: process.env.SES_PASSWORD || smtpPassword,
        },
      });
    }
    // For Gmail
    else if (emailProvider === 'gmail' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
    }
    // Generic SMTP
    else if (smtpUser && smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
    } else {
      // Development mode: create a test account (ethereal.email)
      this.logger.warn('No email configuration found. Using test mode (emails will not be sent).');
      this.logger.warn('Set EMAIL_PROVIDER and credentials to enable email sending.');
    }
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
  }): Promise<{ messageId?: string; success: boolean; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@medicore.co.zw';
    const fromName = process.env.EMAIL_FROM_NAME || 'MediCore EHR';

    // If no transporter configured, log and return success (for development)
    if (!this.transporter) {
      this.logger.log(`[Email Test Mode] Would send email to: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
      this.logger.log(`[Email Test Mode] Subject: ${options.subject}`);
      return { success: true, messageId: `test-${Date.now()}` };
    }

    try {
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text?.replace(/\n/g, '<br>'),
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendBulkEmail(
    recipients: string[],
    subject: string,
    text?: string,
    html?: string,
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>,
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const recipient of recipients) {
      const result = await this.sendEmail({
        to: recipient,
        subject,
        text,
        html,
        attachments,
      });

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${recipient}: ${result.error || 'Unknown error'}`);
      }
    }

    return results;
  }
}


