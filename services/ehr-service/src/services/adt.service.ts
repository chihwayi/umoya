import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Admission } from '../entities/admission.entity';
import { Discharge } from '../entities/discharge.entity';
import { PatientTransfer } from '../entities/patient-transfer.entity';
import { BedManagementService } from './bed-management.service';

@Injectable()
export class ADTService {
  private readonly logger = new Logger(ADTService.name);

  constructor(private bedManagementService: BedManagementService) {}

  private async generateAdmissionNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM admissions WHERE admission_number LIKE 'ADM-%'`,
    );
    const count = parseInt(result.count) + 1;
    return `ADM-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  async admitPatient(
    admissionData: {
      patientId: string;
      admissionType: string;
      admissionSource?: string;
      admittingProvider: string;
      admittingDiagnosis: string;
      admittingDiagnosisIcd10?: string;
      admittingDiagnosisSnomed?: string;
      bedId?: string;
      ward?: string;
      service?: string;
      notes?: string;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<Admission> {
    this.logger.log(`Admitting patient with data: ${JSON.stringify(admissionData)}`);
    
    const repository = tenantDb.getRepository(Admission);

    // Generate admission number
    const admissionNumber = await this.generateAdmissionNumber(tenantDb);

    const admission = repository.create({
      patientId: admissionData.patientId,
      admissionNumber,
      admissionDate: new Date(),
      admissionTime: new Date(),
      admissionType: admissionData.admissionType,
      admissionSource: admissionData.admissionSource,
      admittingProvider: admissionData.admittingProvider,
      admittingDiagnosis: admissionData.admittingDiagnosis,
      admittingDiagnosisIcd10: admissionData.admittingDiagnosisIcd10,
      admittingDiagnosisSnomed: admissionData.admittingDiagnosisSnomed,
      attendingProvider: admissionData.admittingProvider,
      initialWard: admissionData.ward,
      currentWard: admissionData.ward,
      initialBedId: admissionData.bedId,
      currentBedId: admissionData.bedId,
      service: admissionData.service,
      expectedLosDays: admissionData.expectedLosDays,
      isolationRequired: admissionData.isolationRequired,
      codeStatus: admissionData.codeStatus,
      notes: admissionData.notes,
      admissionStatus: 'active',
    });

    const saved = await repository.save(admission);

    // Assign bed if provided
    if (admissionData.bedId) {
      await this.bedManagementService.assignBed(
        admissionData.bedId,
        admissionData.patientId,
        saved.id,
        userId,
        tenantDb,
      );
    }

    this.logger.log(`Patient admitted: ${admissionNumber}`);
    return saved;
  }

  async dischargePatient(
    admissionId: string,
    dischargeData: {
      dischargeType: string;
      dischargeDisposition: string;
      dischargeDiagnosis: string;
      dischargeDiagnosisIcd10?: string;
      dischargeDiagnosisSnomed?: string;
      drgCode?: string;
      dischargeInstructions?: string;
      followUpDate?: Date;
      notes?: string;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<Discharge> {
    const admissionRepo = tenantDb.getRepository(Admission);
    const dischargeRepo = tenantDb.getRepository(Discharge);

    const admission = await admissionRepo.findOne({
      where: { id: admissionId },
      relations: ['patient'],
    });

    if (!admission) {
      throw new NotFoundException(`Admission not found: ${admissionId}`);
    }

    if (admission.admissionStatus !== 'active') {
      throw new BadRequestException('Admission is not active');
    }

    // Calculate LOS
    const admissionTime = new Date(admission.admissionTime);
    const dischargeTime = new Date();
    const lengthOfStayHours = Math.floor((dischargeTime.getTime() - admissionTime.getTime()) / (1000 * 60 * 60));

    // Create discharge record
    const discharge = dischargeRepo.create({
      admissionId,
      patientId: admission.patientId,
      dischargeDate: dischargeTime,
      dischargeTime,
      ...dischargeData,
      dischargeProvider: userId,
      lengthOfStayHours,
    });

    const saved = await dischargeRepo.save(discharge);

    // Update admission status
    admission.admissionStatus = 'discharged';
    await admissionRepo.save(admission);

    // Release bed
    if (admission.currentBedId) {
      await this.bedManagementService.releaseBed(
        admission.currentBedId,
        userId,
        'Patient discharged',
        tenantDb,
      );
    }

    this.logger.log(`Patient discharged: ${admission.admissionNumber}`);
    return saved;
  }

  async transferPatient(
    admissionId: string,
    transferData: {
      transferType: string;
      fromBedId?: string;
      toBedId?: string;
      toWard?: string;
      toService?: string;
      transferReason: string;
      acceptingProvider?: string;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<PatientTransfer> {
    const admissionRepo = tenantDb.getRepository(Admission);
    const transferRepo = tenantDb.getRepository(PatientTransfer);

    const admission = await admissionRepo.findOne({
      where: { id: admissionId },
      relations: ['currentBed'],
    });

    if (!admission) {
      throw new NotFoundException(`Admission not found: ${admissionId}`);
    }

    const transfer = transferRepo.create({
      admissionId,
      patientId: admission.patientId,
      transferDate: new Date(),
      transferTime: new Date(),
      ...transferData,
      fromBedId: admission.currentBedId,
      fromWard: admission.currentWard,
      fromService: admission.service,
      transferringProvider: userId,
      transferAccepted: true,
      transferCompleted: false,
    });

    const saved = await transferRepo.save(transfer);

    // If internal transfer, update admission and beds
    if (transferData.transferType.startsWith('internal')) {
      // Release old bed
      if (admission.currentBedId) {
        await this.bedManagementService.releaseBed(
          admission.currentBedId,
          userId,
          'Patient transferred',
          tenantDb,
        );
      }

      // Assign new bed
      if (transferData.toBedId) {
        await this.bedManagementService.assignBed(
          transferData.toBedId,
          admission.patientId,
          admissionId,
          userId,
          tenantDb,
        );
      }

      // Update admission
      admission.currentBedId = transferData.toBedId || null;
      admission.currentWard = transferData.toWard || admission.currentWard;
      admission.service = transferData.toService || admission.service;
      admission.attendingProvider = transferData.acceptingProvider || admission.attendingProvider;
      await admissionRepo.save(admission);

      // Mark transfer completed
      transfer.transferCompleted = true;
      transfer.transferCompletedTime = new Date();
      await transferRepo.save(transfer);
    }

    this.logger.log(`Patient transferred: ${admission.admissionNumber}`);
    return saved;
  }

  async getActiveAdmissions(
    filters: { wardName?: string; service?: string },
    tenantDb: DataSource,
  ): Promise<Admission[]> {
    const repository = tenantDb.getRepository(Admission);
    const queryBuilder = repository
      .createQueryBuilder('admission')
      .leftJoinAndSelect('admission.patient', 'patient')
      .leftJoinAndSelect('admission.currentBed', 'bed')
      .leftJoinAndSelect('admission.attendingProviderUser', 'provider')
      .where('admission.admissionStatus = :status', { status: 'active' });

    if (filters.wardName) {
      queryBuilder.andWhere('admission.currentWard = :wardName', {
        wardName: filters.wardName,
      });
    }

    if (filters.service) {
      queryBuilder.andWhere('admission.service = :service', { service: filters.service });
    }

    queryBuilder.orderBy('admission.admissionDate', 'DESC');

    return await queryBuilder.getMany();
  }

  async getCensusSnapshot(wardName?: string, tenantDb?: DataSource): Promise<any> {
    const occupancy = await this.bedManagementService.getBedOccupancy(wardName, tenantDb);
    
    const [admissionsToday] = await tenantDb.query(
      wardName
        ? `SELECT COUNT(*) as count FROM admissions WHERE DATE(admission_date) = CURRENT_DATE AND current_ward = $1`
        : `SELECT COUNT(*) as count FROM admissions WHERE DATE(admission_date) = CURRENT_DATE`,
      wardName ? [wardName] : [],
    );

    const [dischargesToday] = await tenantDb.query(
      wardName
        ? `SELECT COUNT(*) as count FROM discharges d JOIN admissions a ON a.id = d.admission_id WHERE DATE(d.discharge_date) = CURRENT_DATE AND a.current_ward = $1`
        : `SELECT COUNT(*) as count FROM discharges WHERE DATE(discharge_date) = CURRENT_DATE`,
      wardName ? [wardName] : [],
    );

    return {
      ...occupancy,
      admissionsToday: parseInt(admissionsToday.count),
      dischargesToday: parseInt(dischargesToday.count),
      wardName: wardName || 'All Wards',
      snapshotTime: new Date(),
    };
  }

  private async logBedStatusChange(
    bedId: string,
    previousStatus: string,
    newStatus: string,
    previousPatientId: string | null,
    newPatientId: string | null,
    userId: string,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO bed_status_log (
        bed_id, previous_status, new_status, previous_patient_id, new_patient_id, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [bedId, previousStatus, newStatus, previousPatientId, newPatientId, userId],
    );
  }
}

