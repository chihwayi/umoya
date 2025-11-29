import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CriticalResultAlert, AlertStatus, CriticalValueType } from '../entities/critical-result-alert.entity';

@Injectable()
export class CriticalAlertService {
  
  async createAlert(alertData: {
    labOrderId: string;
    patientId: string;
    orderingProviderId: string;
    testCode: string;
    testName: string;
    resultValue: string;
    criticalValueType: CriticalValueType;
    alertMessage: string;
  }, tenantDb: DataSource): Promise<CriticalResultAlert> {
    const alertRepository = tenantDb.getRepository(CriticalResultAlert);
    
    const alert = alertRepository.create({
      ...alertData,
      status: AlertStatus.PENDING
    });
    
    return alertRepository.save(alert);
  }

  async getPendingAlerts(providerId: string, tenantDb: DataSource): Promise<CriticalResultAlert[]> {
    const alertRepository = tenantDb.getRepository(CriticalResultAlert);
    
    return alertRepository.find({
      where: {
        orderingProviderId: providerId,
        status: AlertStatus.PENDING
      },
      relations: ['patient', 'labOrder'],
      order: { createdAt: 'DESC' }
    });
  }

  async acknowledgeAlert(
    alertId: string,
    userId: string,
    notes: string | undefined,
    tenantDb: DataSource
  ): Promise<CriticalResultAlert> {
    const alertRepository = tenantDb.getRepository(CriticalResultAlert);
    
    const alert = await alertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Critical alert not found');
    }
    
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    alert.acknowledgmentNotes = notes;
    
    return alertRepository.save(alert);
  }

  async dismissAlert(alertId: string, userId: string, tenantDb: DataSource): Promise<CriticalResultAlert> {
    const alertRepository = tenantDb.getRepository(CriticalResultAlert);
    
    const alert = await alertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Critical alert not found');
    }
    
    alert.status = AlertStatus.DISMISSED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    
    return alertRepository.save(alert);
  }

  async getPatientAlerts(patientId: string, tenantDb: DataSource): Promise<CriticalResultAlert[]> {
    const alertRepository = tenantDb.getRepository(CriticalResultAlert);
    
    return alertRepository.find({
      where: { patientId },
      relations: ['labOrder'],
      order: { createdAt: 'DESC' },
      take: 10
    });
  }
}

