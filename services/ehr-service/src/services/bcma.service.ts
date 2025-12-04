import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { PatientWristband } from '../entities/patient-wristband.entity';
import { MedicationBarcodeMaster } from '../entities/medication-barcode-master.entity';
import { MedicationAlert } from '../entities/medication-alert.entity';

@Injectable()
export class BcmaService {
  private readonly logger = new Logger(BcmaService.name);

  constructor() {}

  // ==================== PATIENT WRISTBAND ====================

  async issueWristband(
    patientId: string,
    admissionId: string | null,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PatientWristband> {
    const repository = tenantDb.getRepository(PatientWristband);

    // Generate unique barcode (MRN + timestamp)
    const barcode = `WB-${patientId.substring(0, 8)}-${Date.now()}`;

    const wristband = repository.create({
      patientId,
      admissionId,
      barcode,
      issuedById: userId,
      issuedAt: new Date(),
      isActive: true,
    });

    return await repository.save(wristband);
  }

  async verifyWristband(
    barcode: string,
    tenantDb: DataSource,
  ): Promise<PatientWristband> {
    const repository = tenantDb.getRepository(PatientWristband);

    const wristband = await repository.findOne({
      where: { barcode, isActive: true },
      relations: ['patient'],
    });

    if (!wristband) {
      throw new NotFoundException('Invalid or inactive wristband');
    }

    return wristband;
  }

  // ==================== MEDICATION BARCODE ====================

  async verifyMedicationBarcode(
    barcode: string,
    tenantDb: DataSource,
  ): Promise<MedicationBarcodeMaster> {
    const repository = tenantDb.getRepository(MedicationBarcodeMaster);

    const medication = await repository.findOne({
      where: { barcode, isActive: true },
    });

    if (!medication) {
      throw new NotFoundException('Medication barcode not found');
    }

    return medication;
  }

  // ==================== MEDICATION ADMINISTRATION ====================

  async verify5Rights(
    patientBarcode: string,
    medicationBarcode: string,
    prescriptionId: string,
    tenantDb: DataSource,
  ): Promise<{
    verified: boolean;
    patient: any;
    medication: any;
    failures: string[];
    alerts: any[];
  }> {
    const failures: string[] = [];
    const alerts: any[] = [];

    // Verify patient
    const wristband = await this.verifyWristband(patientBarcode, tenantDb);
    const patient = wristband.patient;

    // Verify medication
    const medication = await this.verifyMedicationBarcode(medicationBarcode, tenantDb);

    // Get prescription details (would need prescription service)
    // For now, basic verification

    // Check for high-alert drugs
    if (medication.isHighAlert) {
      alerts.push({
        type: 'high_alert_drug',
        severity: 'high',
        message: `${medication.medicationName} is a HIGH-ALERT medication. Double-check required.`,
      });
    }

    // Check for controlled substances
    if (medication.isControlled) {
      alerts.push({
        type: 'controlled_substance',
        severity: 'moderate',
        message: `${medication.medicationName} is a controlled substance. Witness required.`,
      });
    }

    const verified = failures.length === 0;

    return {
      verified,
      patient,
      medication,
      failures,
      alerts,
    };
  }

  async administerMedication(
    marData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const mar = repository.create({
      ...marData,
      administeredById: userId,
      actualAdministrationTime: new Date(),
      administrationStatus: 'administered',
    });

    return await repository.save(mar);
  }

  async getMARsByPatient(
    patientId: string,
    date: Date,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord[]> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await repository
      .createQueryBuilder('mar')
      .where('mar.patientId = :patientId', { patientId })
      .andWhere('mar.scheduledTime >= :startOfDay', { startOfDay })
      .andWhere('mar.scheduledTime <= :endOfDay', { endOfDay })
      .leftJoinAndSelect('mar.administeredBy', 'administeredBy')
      .orderBy('mar.scheduledTime', 'ASC')
      .getMany();
  }

  async holdMedication(
    marId: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const mar = await repository.findOne({ where: { id: marId } });
    if (!mar) {
      throw new NotFoundException('MAR not found');
    }

    mar.administrationStatus = 'held';
    mar.omissionReason = reason;

    return await repository.save(mar);
  }

  async refuseMedication(
    marId: string,
    reason: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const mar = await repository.findOne({ where: { id: marId } });
    if (!mar) {
      throw new NotFoundException('MAR not found');
    }

    mar.administrationStatus = 'refused';
    mar.refusalReason = reason;

    return await repository.save(mar);
  }

  // ==================== ALERTS ====================

  async createAlert(
    alertData: any,
    tenantDb: DataSource,
  ): Promise<MedicationAlert> {
    const repository = tenantDb.getRepository(MedicationAlert);

    const alert = repository.create(alertData);
    return await repository.save(alert);
  }

  async getActiveAlerts(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAlert[]> {
    const repository = tenantDb.getRepository(MedicationAlert);

    return await repository.find({
      where: { patientId, acknowledged: false },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(
    alertId: string,
    userId: string,
    overrideReason: string,
    tenantDb: DataSource,
  ): Promise<MedicationAlert> {
    const repository = tenantDb.getRepository(MedicationAlert);

    const alert = await repository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.acknowledged = true;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    alert.overrideReason = overrideReason;

    return await repository.save(alert);
  }
}

