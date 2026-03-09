import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { PatientWristband } from '../entities/patient-wristband.entity';
import { MedicationBarcodeMaster } from '../entities/medication-barcode-master.entity';
import { MedicationAlert } from '../entities/medication-alert.entity';
import { Prescription } from '../entities/prescription.entity';

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

    return await repository.save(mar) as unknown as MedicationAdministrationRecord;
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

    try {
      return await repository
        .createQueryBuilder('mar')
        .where('mar.patient_id = :patientId', { patientId })
        .andWhere('mar.scheduled_time >= :startOfDay', { startOfDay })
        .andWhere('mar.scheduled_time <= :endOfDay', { endOfDay })
        .leftJoinAndSelect('mar.administeredBy', 'administeredBy')
        .leftJoinAndSelect('mar.witnessedBy', 'witnessedBy')
        .orderBy('mar.scheduled_time', 'ASC')
        .getMany();
    } catch (error) {
      // Fallback: use raw query if TypeORM has issues
      return await tenantDb.query(
        `SELECT mar.*, 
         u1.first_name as administered_by_first_name, u1.last_name as administered_by_last_name,
         u2.first_name as witnessed_by_first_name, u2.last_name as witnessed_by_last_name
         FROM medication_administration_records mar
         LEFT JOIN users u1 ON mar.administered_by = u1.id
         LEFT JOIN users u2 ON mar.witnessed_by = u2.id
         WHERE mar.patient_id = $1 
         AND mar.scheduled_time >= $2 
         AND mar.scheduled_time <= $3
         ORDER BY mar.scheduled_time ASC`,
        [patientId, startOfDay, endOfDay]
      );
    }
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
    return await repository.save(alert) as unknown as MedicationAlert;
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

  // ==================== PRESCRIPTION-TO-MAR ====================

  private frequencyToTimes(frequency: string, date: Date): Date[] {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const f = (frequency || '').toLowerCase();
    const times: Date[] = [];
    if (f.includes('once') || f === 'od' || f === 'daily') {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
    } else if (f.includes('twice') || f === 'bd' || f.includes('bid')) {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 20 * 60 * 60 * 1000));
    } else if (f.includes('three') || f === 'tds' || f.includes('tid') || f.includes('8hr')) {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 14 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 20 * 60 * 60 * 1000));
    } else if (f.includes('four') || f === 'qds' || f.includes('qid') || f.includes('6hr')) {
      for (const h of [6, 12, 18, 24]) times.push(new Date(day.getTime() + h * 60 * 60 * 1000));
    } else {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
    }
    return times;
  }

  async generateMARFromPrescription(
    prescriptionId: string,
    patientId: string,
    admissionId: string | null,
    tenantDb: DataSource,
  ): Promise<any[]> {
    const prescription = await tenantDb.getRepository(Prescription).findOne({ where: { id: prescriptionId, patientId } });
    if (!prescription) throw new NotFoundException('Prescription not found');
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const times = this.frequencyToTimes(prescription.frequency, start);
    const entries: any[] = [];
    for (const t of times) {
      if (t >= start && t < end) {
        const [row] = await tenantDb.query(
          `INSERT INTO mar_scheduled_entries (prescription_id, patient_id, admission_id, medication_name, dose, frequency, scheduled_time, requires_witness, is_high_alert, is_controlled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, false) RETURNING *`,
          [prescriptionId, patientId, admissionId, prescription.medicationName, prescription.dosage, prescription.frequency, t],
        );
        entries.push(row);
      }
    }
    this.logger.log(`Generated ${entries.length} MAR scheduled entries for prescription ${prescriptionId}`);
    return entries;
  }

  async getScheduledMARByPatient(patientId: string, date: Date, tenantDb: DataSource): Promise<any[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return tenantDb.query(
      `SELECT * FROM mar_scheduled_entries WHERE patient_id = $1 AND scheduled_time >= $2 AND scheduled_time < $3 ORDER BY scheduled_time`,
      [patientId, start, end],
    );
  }

  async administerFromScheduledEntry(
    marEntryId: string,
    body: { witnessedById?: string; notes?: string },
    actorId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const [entry] = await tenantDb.query(`SELECT * FROM mar_scheduled_entries WHERE id = $1`, [marEntryId]);
    if (!entry) throw new NotFoundException('MAR scheduled entry not found');
    if (entry.status === 'administered') throw new BadRequestException('Already administered');
    if (entry.requires_witness && !body.witnessedById) {
      throw new BadRequestException('Witness required for this medication');
    }
    const marRepo = tenantDb.getRepository(MedicationAdministrationRecord);
    const mar = marRepo.create({
      patientId: entry.patient_id,
      prescriptionId: entry.prescription_id,
      medicationName: entry.medication_name,
      dose: entry.dose,
      unit: entry.unit || 'tab',
      route: entry.route || 'oral',
      scheduledTime: entry.scheduled_time,
      actualAdministrationTime: new Date(),
      administeredById: actorId,
      witnessedById: body.witnessedById || null,
      administrationStatus: 'administered',
      notes: body.notes,
    });
    const saved = await marRepo.save(mar);
    await tenantDb.query(
      `UPDATE mar_scheduled_entries SET status = 'administered', mar_id = $1, updated_at = NOW() WHERE id = $2`,
      [saved.id, marEntryId],
    );
    return saved;
  }
}

