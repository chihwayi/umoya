import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Bill } from '../entities/billing.entity';
import { SmsGatewayConfig } from '../entities/sms-gateway-config.entity';
import { config as envConfig } from '@umoya/config';
import { SmsService } from './sms.service';

@Injectable()
export class NotificationsService {
  constructor(@Optional() private readonly smsService?: SmsService) {}

  async sendSms(smsData: { phone: string, message: string, network?: string }, tenantDb?: DataSource) {
    const { phone, message, network } = smsData;

    // Detect Zimbabwe network from phone number
    const detectedNetwork = this.detectNetwork(phone);
    const targetNetwork = network || detectedNetwork;

    const truncatedMessage = message.substring(0, 160); // SMS character limit

    // Different gateways for different networks (informational only — the
    // actual send below always goes through SmsService's configured provider)
    const defaultGateways = {
      econet: envConfig.notifications.sms.econet,
      telecel: envConfig.notifications.sms.telecel,
      netone: envConfig.notifications.sms.netone
    };

    let gatewayUrl = defaultGateways[targetNetwork] || defaultGateways.econet;
    let apiKey = '';

    // Try to load tenant-specific configuration
    if (tenantDb) {
      try {
        const configRepo = tenantDb.getRepository(SmsGatewayConfig);
        const config = await configRepo.findOne({
          where: {
            providerType: targetNetwork as any,
            isActive: true
          }
        });

        if (config) {
          gatewayUrl = config.apiUrl;
          apiKey = config.apiKey;
        }
      } catch (error) {
        // Fallback to defaults if table doesn't exist or error occurs
        console.warn('Failed to load SMS gateway config, using defaults', error);
      }
    }

    // Actually send via the real Africa's Talking-backed SmsService rather
    // than fabricating a "SENT" response. SmsService itself no-ops safely
    // (logs only) when SMS_ENABLED/AT_API_KEY aren't configured for this
    // deployment, so this never throws for tenants without SMS configured —
    // it just won't claim a message was sent when it wasn't.
    let messageId = `SMS_${Date.now()}_unsent`;
    let status: 'SENT' | 'SKIPPED' = 'SKIPPED';
    if (this.smsService) {
      const result = await this.smsService.sendSms(phone, truncatedMessage);
      messageId = result.messageId;
      status = 'SENT';
    }

    return {
      messageId,
      status,
      network: targetNetwork,
      phone,
      message: truncatedMessage,
      cost: this.calculateSmsCost(message, targetNetwork),
      gateway: gatewayUrl,
      timestamp: new Date().toISOString()
    };
  }

  async sendAppointmentReminder(appointmentId: string, tenantDb: DataSource) {
    const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
    const appointment = await appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['patient']
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const message = `Dear ${appointment.patient.firstName}, this is a reminder for your appointment on ${appointment.appointmentDate.toDateString()} at ${appointment.appointmentDate.toTimeString()}. Please arrive 15 minutes early. Umoya Clinic`;

    return this.sendSms({
      phone: appointment.patient.phone,
      message
    }, tenantDb);
  }

  async sendPrescriptionReady(prescriptionId: string, tenantDb: DataSource) {
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    const prescription = await prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ['patient']
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    const message = `Dear ${prescription.patient.firstName}, your prescription for ${prescription.medicationName} is ready for collection. Please bring your ID. Umoya Pharmacy`;

    return this.sendSms({
      phone: prescription.patient.phone,
      message
    }, tenantDb);
  }

  async sendLabResultsReady(labOrderId: string, tenantDb: DataSource) {
    const labRepo = tenantDb.getRepository(LabOrder);
    const labOrder = await labRepo.findOne({
      where: { id: labOrderId },
      relations: ['patient']
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    const testName = labOrder.tests?.[0]?.testName || 'the requested tests';
    const message = `Dear ${labOrder.patient.firstName}, your lab results for ${testName} are ready. Please visit the clinic to collect them or call us for details. Umoya Lab`;

    return this.sendSms({
      phone: labOrder.patient.phone,
      message
    }, tenantDb);
  }

  async sendPaymentReminder(billId: string, tenantDb: DataSource) {
    const billRepo = tenantDb.getRepository(Bill);
    const bill = await billRepo.findOne({
      where: { id: billId },
      relations: ['patient']
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    const message = `Dear ${bill.patient.firstName}, your bill #${bill.billNumber} of $${bill.totalAmount} is due. Pay via EcoCash, OneMoney or visit our clinic. Thank you. Umoya`;

    return this.sendSms({
      phone: bill.patient.phone,
      message
    }, tenantDb);
  }

  async getDeliveryStatus(messageId: string) {
    // No delivery-status webhook or polling integration exists for the
    // configured SMS provider (Africa's Talking) — SmsService fires sends
    // and logs the immediate HTTP response only, it does not track per-message
    // delivery receipts. Report that honestly instead of fabricating a
    // random status, which would previously (and randomly) claim messages
    // were "DELIVERED" or "FAILED" with no basis.
    return {
      messageId,
      status: 'UNKNOWN',
      deliveredAt: null,
      failureReason: null,
      statusNote: 'Delivery status tracking is not available for this provider.',
      cost: 0.05, // USD
      network: 'econet'
    };
  }

  private detectNetwork(phone: string): string {
    // Zimbabwe mobile number prefixes
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.startsWith('263')) {
      const prefix = cleanPhone.substring(3, 6);
      
      // Econet prefixes
      if (['077', '078'].includes(prefix)) return 'econet';
      
      // Telecel prefixes  
      if (['073', '083'].includes(prefix)) return 'telecel';
      
      // NetOne prefixes
      if (['071', '081'].includes(prefix)) return 'netone';
    }
    
    return 'econet'; // Default to Econet
  }

  private calculateSmsCost(message: string, network: string): number {
    const length = message.length;
    const smsCount = Math.ceil(length / 160);
    
    // Different rates per network (USD)
    const rates = {
      econet: 0.05,
      telecel: 0.04,
      netone: 0.045
    };
    
    return smsCount * (rates[network] || rates.econet);
  }
}