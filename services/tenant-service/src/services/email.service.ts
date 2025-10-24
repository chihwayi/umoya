import { Injectable, Logger } from '@nestjs/common';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(template: EmailTemplate) {
    // In production, integrate with SendGrid, AWS SES, or similar
    this.logger.log(`Sending email to ${template.to}: ${template.subject}`);
    
    // For development, just log the email content
    console.log('=== EMAIL ===');
    console.log(`To: ${template.to}`);
    console.log(`Subject: ${template.subject}`);
    console.log(`Body: ${template.html}`);
    console.log('=============');
  }

  async sendWelcomeEmail(tenantEmail: string, tenantName: string, subdomain: string, tempPassword: string) {
    const template: EmailTemplate = {
      to: tenantEmail,
      subject: 'Welcome to MediCore - Your EHR System is Ready!',
      html: `
        <h2>Welcome to MediCore!</h2>
        <p>Dear ${tenantName} team,</p>
        <p>Your Electronic Health Record system has been successfully set up!</p>
        
        <h3>Your Account Details:</h3>
        <ul>
          <li><strong>Clinic:</strong> ${tenantName}</li>
          <li><strong>System URL:</strong> https://${subdomain}.medicore.co.zw</li>
          <li><strong>Login Email:</strong> ${tenantEmail}</li>
          <li><strong>Temporary Password:</strong> ${tempPassword}</li>
        </ul>
        
        <p><strong>Important:</strong> Please change your password immediately after first login.</p>
        
        <h3>Next Steps:</h3>
        <ol>
          <li>Log in to your system</li>
          <li>Change your password</li>
          <li>Add your staff members</li>
          <li>Configure your clinic settings</li>
        </ol>
        
        <p>If you need any assistance, please contact our support team.</p>
        <p>Best regards,<br>MediCore Team</p>
      `
    };

    return this.sendEmail(template);
  }

  async sendPasswordResetEmail(email: string, resetToken: string) {
    const template: EmailTemplate = {
      to: email,
      subject: 'MediCore - Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your MediCore account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="https://admin.medicore.co.zw/reset-password?token=${resetToken}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>MediCore Team</p>
      `
    };

    return this.sendEmail(template);
  }

  async sendTenantSuspensionEmail(tenantEmail: string, tenantName: string, reason: string) {
    const template: EmailTemplate = {
      to: tenantEmail,
      subject: 'MediCore - Account Suspended',
      html: `
        <h2>Account Suspension Notice</h2>
        <p>Dear ${tenantName} team,</p>
        <p>Your MediCore account has been temporarily suspended.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please contact our support team to resolve this issue.</p>
        <p>Best regards,<br>MediCore Team</p>
      `
    };

    return this.sendEmail(template);
  }
}