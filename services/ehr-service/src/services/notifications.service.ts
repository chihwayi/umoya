import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Bill } from '../entities/billing.entity';
import { SmsGatewayConfig } from '../entities/sms-gateway-config.entity';

@Injectable()
export class NotificationsService {
  
  async sendSms(smsData: { phone: string, message: string, network?: string }, tenantDb?: DataSource) {
    const { phone, message, network } = smsData;
    
    // Detect Zimbabwe network from phone number
    const detectedNetwork = this.detectNetwork(phone);
    const targetNetwork = network || detectedNetwork;
    
    // Simulate SMS gateway integration
    const messageId = `SMS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Different gateways for different networks
    const defaultGateways = {
      econet: 'https://api.econet.co.zw/sms',
      telecel: 'https://api.telecel.co.zw/sms', 
      netone: 'https://api.netone.co.zw/sms'
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

    return {
      messageId,
      status: 'SENT',
      network: targetNetwork,
      phone,
      message: message.substring(0, 160), // SMS character limit
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

    const message = `Dear ${appointment.patient.firstName}, this is a reminder for your appointment on ${appointment.appointmentDate.toDateString()} at ${appointment.appointmentDate.toTimeString()}. Please arrive 15 minutes early. MediCore Clinic`;

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

    const message = `Dear ${prescription.patient.firstName}, your prescription for ${prescription.medicationName} is ready for collection. Please bring your ID. MediCore Pharmacy`;

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
    const message = `Dear ${labOrder.patient.firstName}, your lab results for ${testName} are ready. Please visit the clinic to collect them or call us for details. MediCore Lab`;

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

    const message = `Dear ${bill.patient.firstName}, your bill #${bill.billNumber} of $${bill.totalAmount} is due. Pay via EcoCash, OneMoney or visit our clinic. Thank you. MediCore`;

    return this.sendSms({
      phone: bill.patient.phone,
      message
    }, tenantDb);
  }

  async getDeliveryStatus(messageId: string) {
    // Simulate delivery status check
    const statuses = ['SENT', 'DELIVERED', 'FAILED', 'PENDING'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      messageId,
      status: randomStatus,
      deliveredAt: randomStatus === 'DELIVERED' ? new Date().toISOString() : null,
      failureReason: randomStatus === 'FAILED' ? 'Invalid number' : null,
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