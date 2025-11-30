import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { VitalsService } from './vitals.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class PatientVitalsSubmissionService {
  private readonly logger = new Logger(PatientVitalsSubmissionService.name);

  constructor(
    private tenantService: TenantService,
    private vitalsService: VitalsService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Get or create a system user for patient self-reported vitals
   */
  private async getOrCreatePatientSelfReportUser(tenantDb: DataSource): Promise<string> {
    // Try to find existing system user for patient self-reports
    const existingUser = await tenantDb.query(
      `SELECT id FROM users WHERE email = 'patient.self.report@system.medicore' LIMIT 1`,
    );

    if (existingUser.length > 0) {
      return existingUser[0].id;
    }

    // Create system user for patient self-reports
    const newUser = await tenantDb.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
      ) VALUES (
        'patient.self.report@system.medicore',
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
  private async checkAbnormalVitals(
    vitals: any,
    patientId: string,
    tenantDb: DataSource,
    tenantId: string,
  ): Promise<void> {
    const alerts: string[] = [];

    // Check blood pressure
    if (vitals.bloodPressure) {
      const bpMatch = vitals.bloodPressure.match(/^(\d+)\/(\d+)$/);
      if (bpMatch) {
        const systolic = parseInt(bpMatch[1]);
        const diastolic = parseInt(bpMatch[2]);
        if (systolic >= 180 || diastolic >= 120) {
          alerts.push('CRITICAL: Very high blood pressure detected. Please seek immediate medical attention.');
        } else if (systolic >= 140 || diastolic >= 90) {
          alerts.push('WARNING: High blood pressure detected. Please consult your doctor.');
        } else if (systolic < 90 || diastolic < 60) {
          alerts.push('WARNING: Low blood pressure detected. Please consult your doctor.');
        }
      }
    }

    // Check heart rate
    if (vitals.heartRate) {
      if (vitals.heartRate > 100) {
        alerts.push('WARNING: Elevated heart rate detected.');
      } else if (vitals.heartRate < 60) {
        alerts.push('WARNING: Low heart rate detected.');
      }
    }

    // Check temperature
    if (vitals.temperature) {
      if (vitals.temperature > 100.4) {
        alerts.push('WARNING: Elevated temperature (fever) detected.');
      } else if (vitals.temperature < 95) {
        alerts.push('WARNING: Low temperature detected.');
      }
    }

    // Check oxygen saturation
    if (vitals.oxygenSaturation) {
      if (vitals.oxygenSaturation < 95) {
        alerts.push('WARNING: Low oxygen saturation detected. Please seek medical attention if symptoms persist.');
      }
    }

    // Check blood glucose
    if (vitals.bloodGlucose) {
      if (vitals.bloodGlucose > 250) {
        alerts.push('WARNING: High blood glucose detected. Please consult your doctor.');
      } else if (vitals.bloodGlucose < 70) {
        alerts.push('CRITICAL: Low blood glucose detected. Please treat immediately.');
      }
    }

    // Send notifications if alerts exist
    if (alerts.length > 0) {
      try {
        // Get patient info for notification
        const patientResult = await tenantDb.query(
          `SELECT first_name, last_name, email FROM patients WHERE id = $1`,
          [patientId],
        );
        const patient = patientResult[0];

        // Create notification for patient
        await this.notificationsService.createNotification(
          tenantDb,
          {
            patientId,
            type: 'vital_alert',
            title: 'Vital Signs Alert',
            message: alerts.join(' '),
            priority: alerts.some((a) => a.includes('CRITICAL')) ? 'high' : 'medium',
          },
          tenantId,
        );

        // Also notify clinic staff for critical alerts
        if (alerts.some((a) => a.includes('CRITICAL'))) {
          await this.notificationsService.createNotification(
            tenantDb,
            {
              type: 'patient_vital_critical',
              title: `Critical Vital Alert - ${patient?.first_name} ${patient?.last_name}`,
              message: `Patient ${patient?.first_name} ${patient?.last_name} submitted critical vitals: ${alerts.join(' ')}`,
              priority: 'critical',
              metadata: { patientId, vitals },
            },
            tenantId,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to send vital alerts: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  /**
   * Submit vitals from patient portal
   */
  async submitPatientVitals(
    patientId: string,
    vitalsData: any,
    tenantId: string,
  ): Promise<{ vitals: any; alerts?: string[]; cdssInsights?: any }> {
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
    };

    // Record vitals using existing service
    const savedVitals = await this.vitalsService.recordVitals(vitalsToSave, tenantId);

    // Check for abnormal values and generate alerts
    await this.checkAbnormalVitals(vitalsData, patientId, tenantDb, tenantId);

    return {
      vitals: savedVitals,
      cdssInsights: savedVitals.cdssInsights || null,
    };
  }
}

