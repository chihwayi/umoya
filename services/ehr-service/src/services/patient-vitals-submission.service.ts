import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RemoteMonitoringEvent } from '../entities/remote-monitoring-event.entity';
import { RemoteMonitoringAlert } from '../entities/remote-monitoring-alert.entity';
import { TenantService } from './tenant.service';
import { VitalsService } from './vitals.service';
import { PatientNotificationsService } from './patient-notifications.service';
import { HealthGoalsService } from './health-goals.service';

export interface GeneratedMonitoringAlert {
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  evidence: Record<string, any>;
}

interface RemoteMonitoringSourceMetadata {
  sourceType?: string;
  sourceName?: string;
  sourceConfidence?: number;
  sourceDeviceId?: string;
  sourceDeviceType?: string;
  sourceVendor?: string;
  sourceModel?: string;
  verificationStatus?: string;
  measurementCount?: number;
}

@Injectable()
export class PatientVitalsSubmissionService {
  private readonly logger = new Logger(PatientVitalsSubmissionService.name);

  constructor(
    private tenantService: TenantService,
    private vitalsService: VitalsService,
    private patientNotificationsService?: PatientNotificationsService,
    private healthGoalsService?: HealthGoalsService,
  ) {}

  /**
   * Get or create a system user for patient self-reported vitals
   */
  private async getOrCreatePatientSelfReportUser(tenantDb: DataSource): Promise<string> {
    // Try to find existing system user for patient self-reports
    const existingUser = await tenantDb.query(
      `SELECT id FROM users WHERE email = 'patient.self.report@system.umoya' LIMIT 1`,
    );

    if (existingUser.length > 0) {
      return existingUser[0].id;
    }

    // Create system user for patient self-reports
    const newUser = await tenantDb.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
      ) VALUES (
        'patient.self.report@system.umoya',
        '$2b$10$dummyhashforpatientreportsystemuser',
        'Patient',
        'Self-Report',
        'nurse',
        true,
        NOW(),
        NOW()
      ) RETURNING id`,
    );

    return newUser[0].id;
  }

  /**
   * Validate vitals data
   */
  private validateVitals(data: any): void {
    if (data.bloodPressure) {
      const bpMatch = data.bloodPressure.match(/^(\d+)\/(\d+)$/);
      if (!bpMatch) {
        throw new BadRequestException('Blood pressure must be in format "systolic/diastolic" (e.g., "120/80")');
      }
      const systolic = parseInt(bpMatch[1]);
      const diastolic = parseInt(bpMatch[2]);
      if (systolic < 50 || systolic > 250) {
        throw new BadRequestException('Systolic blood pressure must be between 50 and 250');
      }
      if (diastolic < 30 || diastolic > 150) {
        throw new BadRequestException('Diastolic blood pressure must be between 30 and 150');
      }
    }

    if (data.heartRate !== undefined && data.heartRate !== null) {
      if (data.heartRate < 30 || data.heartRate > 220) {
        throw new BadRequestException('Heart rate must be between 30 and 220 bpm');
      }
    }

    if (data.temperature !== undefined && data.temperature !== null) {
      if (data.temperature < 90 || data.temperature > 110) {
        throw new BadRequestException('Temperature must be between 90°F and 110°F (or equivalent in Celsius)');
      }
    }

    if (data.oxygenSaturation !== undefined && data.oxygenSaturation !== null) {
      if (data.oxygenSaturation < 70 || data.oxygenSaturation > 100) {
        throw new BadRequestException('Oxygen saturation must be between 70% and 100%');
      }
    }

    if (data.respiratoryRate !== undefined && data.respiratoryRate !== null) {
      if (data.respiratoryRate < 8 || data.respiratoryRate > 40) {
        throw new BadRequestException('Respiratory rate must be between 8 and 40 per minute');
      }
    }

    if (data.weight !== undefined && data.weight !== null) {
      if (data.weight < 1 || data.weight > 500) {
        throw new BadRequestException('Weight must be between 1 and 500 kg');
      }
    }

    if (data.height !== undefined && data.height !== null) {
      if (data.height < 30 || data.height > 250) {
        throw new BadRequestException('Height must be between 30 and 250 cm');
      }
    }

    if (data.bloodGlucose !== undefined && data.bloodGlucose !== null) {
      if (data.bloodGlucose < 20 || data.bloodGlucose > 600) {
        throw new BadRequestException('Blood glucose must be between 20 and 600 mg/dL');
      }
    }

    if (data.painLevel !== undefined && data.painLevel !== null) {
      if (data.painLevel < 0 || data.painLevel > 10) {
        throw new BadRequestException('Pain level must be between 0 and 10');
      }
    }
  }

  /**
   * Check for abnormal vitals and generate alerts
   */
  private buildThresholdAlerts(vitals: any): GeneratedMonitoringAlert[] {
    const alerts: GeneratedMonitoringAlert[] = [];

    // Check blood pressure
    if (vitals.bloodPressure) {
      const bpMatch = vitals.bloodPressure.match(/^(\d+)\/(\d+)$/);
      if (bpMatch) {
        const systolic = parseInt(bpMatch[1]);
        const diastolic = parseInt(bpMatch[2]);
        if (systolic >= 180 || diastolic >= 120) {
          alerts.push({
            alertType: 'hypertensive_crisis',
            severity: 'critical',
            title: 'Critical blood pressure alert',
            message: 'Very high blood pressure detected. Seek immediate medical attention.',
            evidence: { systolic, diastolic },
          });
        } else if (systolic >= 140 || diastolic >= 90) {
          alerts.push({
            alertType: 'high_blood_pressure',
            severity: 'high',
            title: 'High blood pressure detected',
            message: 'High blood pressure detected. Please consult your doctor.',
            evidence: { systolic, diastolic },
          });
        } else if (systolic < 90 || diastolic < 60) {
          alerts.push({
            alertType: 'low_blood_pressure',
            severity: 'high',
            title: 'Low blood pressure detected',
            message: 'Low blood pressure detected. Please consult your doctor.',
            evidence: { systolic, diastolic },
          });
        }
      }
    }

    // Check heart rate
    if (vitals.heartRate) {
      if (vitals.heartRate > 100) {
        alerts.push({
          alertType: 'tachycardia',
          severity: 'medium',
          title: 'Elevated heart rate detected',
          message: 'Elevated heart rate detected.',
          evidence: { heartRate: vitals.heartRate },
        });
      } else if (vitals.heartRate < 60) {
        alerts.push({
          alertType: 'bradycardia',
          severity: 'medium',
          title: 'Low heart rate detected',
          message: 'Low heart rate detected.',
          evidence: { heartRate: vitals.heartRate },
        });
      }
    }

    // Check temperature
    if (vitals.temperature) {
      if (vitals.temperature > 100.4) {
        alerts.push({
          alertType: 'fever',
          severity: 'medium',
          title: 'Fever detected',
          message: 'Elevated temperature detected.',
          evidence: { temperature: vitals.temperature },
        });
      } else if (vitals.temperature < 95) {
        alerts.push({
          alertType: 'hypothermia_risk',
          severity: 'high',
          title: 'Low temperature detected',
          message: 'Low temperature detected.',
          evidence: { temperature: vitals.temperature },
        });
      }
    }

    // Check oxygen saturation
    if (vitals.oxygenSaturation) {
      if (vitals.oxygenSaturation < 95) {
        alerts.push({
          alertType: 'low_oxygen_saturation',
          severity: vitals.oxygenSaturation < 90 ? 'critical' : 'high',
          title: 'Low oxygen saturation detected',
          message: 'Low oxygen saturation detected. Seek medical attention if symptoms persist.',
          evidence: { oxygenSaturation: vitals.oxygenSaturation },
        });
      }
    }

    // Check blood glucose
    if (vitals.bloodGlucose) {
      if (vitals.bloodGlucose > 250) {
        alerts.push({
          alertType: 'hyperglycemia',
          severity: 'high',
          title: 'High blood glucose detected',
          message: 'High blood glucose detected. Please consult your doctor.',
          evidence: { bloodGlucose: vitals.bloodGlucose },
        });
      } else if (vitals.bloodGlucose < 70) {
        alerts.push({
          alertType: 'hypoglycemia',
          severity: 'critical',
          title: 'Low blood glucose detected',
          message: 'Low blood glucose detected. Please treat immediately.',
          evidence: { bloodGlucose: vitals.bloodGlucose },
        });
      }
    }

    return alerts;
  }

  /**
   * Send patient notifications for generated alerts
   */
  private async notifyAlerts(
    alerts: GeneratedMonitoringAlert[],
    vitals: any,
    patientId: string,
    tenantDb: DataSource,
    tenantId: string,
  ): Promise<void> {
    // Send notifications if alerts exist
    if (alerts.length > 0 && this.patientNotificationsService) {
      try {
        // Create notification for patient
        await this.patientNotificationsService.createNotification(
          patientId,
          'vital_alert' as any,
          'Vital Signs Alert',
          alerts.map((alert) => alert.message).join(' '),
          tenantId,
          {
            priority: alerts.some((alert) => alert.severity === 'critical') ? 'high' : 'normal',
            actionUrl: '/vitals',
            actionLabel: 'View Vitals',
            metadata: { alerts, vitals },
          },
        );
      } catch (error) {
        this.logger.warn(`Failed to send vital alerts: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  private async persistRemoteMonitoringArtifacts(
    tenantDb: DataSource,
    patientId: string,
    vitalsData: any & RemoteMonitoringSourceMetadata,
    savedVitals: any,
    generatedAlerts: GeneratedMonitoringAlert[],
  ) {
    const eventRepo = tenantDb.getRepository(RemoteMonitoringEvent);
    const alertRepo = tenantDb.getRepository(RemoteMonitoringAlert);

    const earlyWarningAssessment = savedVitals.earlyWarningAssessment || null;
    const event = eventRepo.create({
      patientId,
      submittedByPatientId: patientId,
      vitalsId: savedVitals.id ?? null,
      deviceId: vitalsData.sourceDeviceId ?? null,
      deviceType: vitalsData.sourceDeviceType ?? null,
      sourceType: vitalsData.sourceType || 'self_report',
      sourceName: vitalsData.sourceName || 'patient_portal',
      sourceVendor: vitalsData.sourceVendor || null,
      sourceModel: vitalsData.sourceModel || null,
      eventType: 'vitals_submission',
      verificationStatus: vitalsData.verificationStatus || (vitalsData.sourceType === 'device' ? 'device_linked' : 'self_reported'),
      sourceConfidence: vitalsData.sourceConfidence ?? 0.8,
      measurementCount: vitalsData.measurementCount ?? this.countSubmittedMeasurements(vitalsData),
      payload: {
        input: vitalsData,
        savedVitalsId: savedVitals.id,
        cdssInsightsPresent: Boolean(savedVitals.cdssInsights),
      },
      evaluationSummary:
        earlyWarningAssessment?.explanationSummary ||
        (generatedAlerts.length > 0
          ? generatedAlerts.map((alert) => alert.title).join('; ')
          : 'No urgent alert conditions detected'),
      alertCount: generatedAlerts.length,
      submittedAt: vitalsData.recordedAt ? new Date(vitalsData.recordedAt) : new Date(),
      processedAt: new Date(),
    });

    const savedEvent = await eventRepo.save(event);

    for (const alert of generatedAlerts) {
      const alertRow = alertRepo.create({
        eventId: savedEvent.id,
        patientId,
        vitalsId: savedVitals.id ?? null,
        linkedEscalationTaskId: earlyWarningAssessment?.escalationTaskId ?? null,
        alertType: alert.alertType,
        severity: alert.severity,
        status: 'open',
        title: alert.title,
        message: alert.message,
        evidence: {
          ...alert.evidence,
          earlyWarningScoreId: earlyWarningAssessment?.id ?? null,
          riskLevel: earlyWarningAssessment?.riskLevel ?? null,
        },
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedAt: null,
      });

      await alertRepo.save(alertRow);
    }

    return savedEvent;
  }

  private countSubmittedMeasurements(vitalsData: Record<string, any>): number {
    const measurementFields = [
      'bloodPressure',
      'heartRate',
      'temperature',
      'oxygenSaturation',
      'respiratoryRate',
      'weight',
      'height',
      'bloodGlucose',
      'painLevel',
    ];

    return measurementFields.filter((field) => vitalsData[field] !== undefined && vitalsData[field] !== null).length;
  }

  /**
   * Submit vitals from patient portal
   */
  async submitPatientVitals(
    patientId: string,
    vitalsData: any & RemoteMonitoringSourceMetadata,
    tenantId: string,
  ): Promise<{ vitals: any; alerts?: GeneratedMonitoringAlert[]; cdssInsights?: any; monitoringEvent?: any }> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Validate vitals data
    this.validateVitals(vitalsData);

    // Get or create system user for patient self-reports
    const recordedByUserId = await this.getOrCreatePatientSelfReportUser(tenantDb);

    // Calculate BMI if weight and height are provided
    let bmi: number | null = null;
    if (vitalsData.weight && vitalsData.height) {
      const heightInMeters = vitalsData.height / 100; // Convert cm to meters
      bmi = vitalsData.weight / (heightInMeters * heightInMeters);
      bmi = Math.round(bmi * 100) / 100; // Round to 2 decimal places
    }

    // Prepare vitals data
    const vitalsToSave = {
      patientId,
      recordedBy: recordedByUserId,
      bloodPressure: vitalsData.bloodPressure || null,
      heartRate: vitalsData.heartRate || null,
      temperature: vitalsData.temperature || null,
      oxygenSaturation: vitalsData.oxygenSaturation || null,
      respiratoryRate: vitalsData.respiratoryRate || null,
      weight: vitalsData.weight || null,
      height: vitalsData.height || null,
      bmi: bmi,
      painLevel: vitalsData.painLevel || null,
      bloodGlucose: vitalsData.bloodGlucose || null,
      notes: vitalsData.notes || null,
      recordedAt: vitalsData.recordedAt ? new Date(vitalsData.recordedAt) : new Date(),
      vitalSource: vitalsData.sourceType || 'patient_self_report',
    };

    // Record vitals using existing service
    const savedVitals = await this.vitalsService.recordVitals(vitalsToSave, tenantId);

    const generatedAlerts = this.buildThresholdAlerts(vitalsData);
    if (savedVitals.earlyWarningAssessment?.alertTriggered) {
      generatedAlerts.push({
        alertType: 'early_warning_deterioration',
        severity: savedVitals.earlyWarningAssessment?.riskLevel === 'high' ? 'critical' : 'high',
        title: `Early warning score ${savedVitals.earlyWarningAssessment.totalScore}`,
        message: savedVitals.earlyWarningAssessment.explanationSummary || 'Early warning score triggered clinical review.',
        evidence: {
          scoreId: savedVitals.earlyWarningAssessment.id,
          totalScore: savedVitals.earlyWarningAssessment.totalScore,
          riskLevel: savedVitals.earlyWarningAssessment.riskLevel,
        },
      });
    }

    const monitoringEvent = await this.persistRemoteMonitoringArtifacts(
      tenantDb,
      patientId,
      vitalsData,
      savedVitals,
      generatedAlerts,
    );

    await this.notifyAlerts(generatedAlerts, vitalsData, patientId, tenantDb, tenantId);

    // Auto-update health goals from vitals
    if (this.healthGoalsService) {
      try {
        await this.healthGoalsService.autoUpdateFromVitals(tenantDb, patientId, {
          ...vitalsData,
          id: savedVitals.id,
        });
      } catch (error) {
        this.logger.warn(`Failed to auto-update health goals from vitals: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      vitals: savedVitals,
      alerts: generatedAlerts,
      cdssInsights: savedVitals.cdssInsights || null,
      monitoringEvent,
    };
  }
}
