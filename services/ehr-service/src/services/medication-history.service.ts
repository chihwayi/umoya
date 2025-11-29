import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  MedicationAdherence,
  MedicationReconciliationLog,
  MedicationStatus,
  MedicationType,
  PatientMedication,
  ReconciliationStatus,
  ReconciliationType,
} from '../entities/patient-medication.entity';
import {
  CreateMedicationDto,
  UpdateMedicationDto,
  RecordAdherenceDto,
  CreateReconciliationDto,
  MedicationReconciliationResultDto,
} from '../dto/medication-history.dto';

interface MedicationFilters {
  type?: MedicationType;
  status?: MedicationStatus;
}

@Injectable()
export class MedicationHistoryService {
  private readonly logger = new Logger(MedicationHistoryService.name);

  private medicationRepository(tenantDb: DataSource): Repository<PatientMedication> {
    return tenantDb.getRepository(PatientMedication);
  }

  private adherenceRepository(tenantDb: DataSource): Repository<MedicationAdherence> {
    return tenantDb.getRepository(MedicationAdherence);
  }

  private reconciliationRepository(tenantDb: DataSource): Repository<MedicationReconciliationLog> {
    return tenantDb.getRepository(MedicationReconciliationLog);
  }

  async getMedications(
    tenantDb: DataSource,
    patientId: string,
    filters: MedicationFilters = {},
  ): Promise<PatientMedication[]> {
    const repository = this.medicationRepository(tenantDb);
    const query = repository
      .createQueryBuilder('medication')
      .where('medication.patientId = :patientId', { patientId })
      .orderBy('medication.startDate', 'DESC')
      .addOrderBy('medication.createdAt', 'DESC');

    if (filters.type) {
      query.andWhere('medication.medicationType = :type', { type: filters.type });
    }

    if (filters.status) {
      query.andWhere('medication.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async getCurrentMedications(tenantDb: DataSource, patientId: string): Promise<PatientMedication[]> {
    return this.getMedications(tenantDb, patientId, {
      type: MedicationType.CURRENT,
      status: MedicationStatus.ACTIVE,
    });
  }

  async getMedicationById(tenantDb: DataSource, medicationId: string): Promise<PatientMedication> {
    const repository = this.medicationRepository(tenantDb);
    const medication = await repository.findOne({ where: { id: medicationId } });
    if (!medication) {
      throw new NotFoundException(`Medication with ID ${medicationId} not found`);
    }
    return medication;
  }

  async createMedication(
    tenantDb: DataSource,
    patientId: string,
    dto: CreateMedicationDto,
    userId?: string,
  ): Promise<PatientMedication> {
    if (!dto.medicationName) {
      throw new BadRequestException('Medication name is required');
    }

    const repository = this.medicationRepository(tenantDb);
    const medication = repository.create({
      patientId,
      medicationName: dto.medicationName,
      genericName: dto.genericName,
      dosage: dto.dosage,
      dosageUnit: dto.dosageUnit,
      frequency: dto.frequency,
      route: dto.route,
      duration: dto.duration,
      medicationType: dto.medicationType || MedicationType.CURRENT,
      status: dto.status || MedicationStatus.ACTIVE,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      notes: dto.notes,
      reconciliationStatus: dto.reconciliationStatus || ReconciliationStatus.VERIFIED,
      reconciliationNotes: dto.reconciliationNotes,
      createdById: userId,
    });

    return repository.save(medication);
  }

  async updateMedication(
    tenantDb: DataSource,
    medicationId: string,
    dto: UpdateMedicationDto,
  ): Promise<PatientMedication> {
    const repository = this.medicationRepository(tenantDb);
    const medication = await this.getMedicationById(tenantDb, medicationId);

    if (dto.startDate) {
      medication.startDate = new Date(dto.startDate);
    }

    if (dto.endDate) {
      medication.endDate = new Date(dto.endDate);
    }

    Object.assign(medication, {
      medicationName: dto.medicationName ?? medication.medicationName,
      genericName: dto.genericName ?? medication.genericName,
      dosage: dto.dosage ?? medication.dosage,
      dosageUnit: dto.dosageUnit ?? medication.dosageUnit,
      frequency: dto.frequency ?? medication.frequency,
      route: dto.route ?? medication.route,
      duration: dto.duration ?? medication.duration,
      medicationType: dto.medicationType ?? medication.medicationType,
      status: dto.status ?? medication.status,
      notes: dto.notes ?? medication.notes,
      reconciliationStatus: dto.reconciliationStatus ?? medication.reconciliationStatus,
      reconciliationNotes: dto.reconciliationNotes ?? medication.reconciliationNotes,
    });

    return repository.save(medication);
  }

  async discontinueMedication(
    tenantDb: DataSource,
    medicationId: string,
    reason: string,
  ): Promise<PatientMedication> {
    const repository = this.medicationRepository(tenantDb);
    const medication = await this.getMedicationById(tenantDb, medicationId);

    medication.status = MedicationStatus.DISCONTINUED;
    medication.reasonForDiscontinuation = reason || 'Discontinued';
    medication.endDate = new Date();

    return repository.save(medication);
  }

  async deleteMedication(tenantDb: DataSource, medicationId: string): Promise<void> {
    const repository = this.medicationRepository(tenantDb);
    await repository.delete(medicationId);
  }

  async recordAdherence(
    tenantDb: DataSource,
    medicationId: string,
    dto: RecordAdherenceDto,
    patientId: string,
    userId?: string,
  ): Promise<MedicationAdherence> {
    const medication = await this.getMedicationById(tenantDb, medicationId);
    if (medication.patientId !== patientId) {
      throw new BadRequestException('Medication does not belong to this patient');
    }

    const repository = this.adherenceRepository(tenantDb);
    const adherence = repository.create({
      medicationId,
      patientId,
      adherenceDate: new Date(dto.adherenceDate),
      taken: dto.taken,
      missedReason: dto.missedReason,
      notes: dto.notes,
      recordedById: userId,
    });

    return repository.save(adherence);
  }

  async getAdherenceRecords(
    tenantDb: DataSource,
    medicationId: string,
    limit = 50,
  ): Promise<MedicationAdherence[]> {
    const repository = this.adherenceRepository(tenantDb);
    return repository.find({
      where: { medicationId },
      order: { adherenceDate: 'DESC' },
      take: limit,
    });
  }

  async calculateAdherencePercentage(
    tenantDb: DataSource,
    medicationId: string,
    days = 30,
  ): Promise<number> {
    const repository = this.adherenceRepository(tenantDb);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const totalRecords = await repository
      .createQueryBuilder('adherence')
      .where('adherence.medicationId = :medicationId', { medicationId })
      .andWhere('adherence.adherenceDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getCount();

    if (totalRecords === 0) {
      return 0;
    }

    const takenRecords = await repository
      .createQueryBuilder('adherence')
      .where('adherence.medicationId = :medicationId', { medicationId })
      .andWhere('adherence.taken = :taken', { taken: true })
      .andWhere('adherence.adherenceDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getCount();

    return Math.round((takenRecords / totalRecords) * 100);
  }

  async performReconciliation(
    tenantDb: DataSource,
    patientId: string,
    dto: CreateReconciliationDto,
    userId?: string,
  ): Promise<MedicationReconciliationResultDto> {
    const medicationRepository = this.medicationRepository(tenantDb);
    const reconciliationRepository = this.reconciliationRepository(tenantDb);

    const currentMedications = await this.getMedications(tenantDb, patientId);

    const medicationsNeedingReview = currentMedications.filter((med) =>
      [ReconciliationStatus.DISCREPANCY, ReconciliationStatus.NEEDS_REVIEW].includes(
        med.reconciliationStatus,
      ),
    );
    const medicationsVerified = currentMedications.filter((med) =>
      med.reconciliationStatus === ReconciliationStatus.VERIFIED,
    );

    const reconciliationLog = reconciliationRepository.create({
      patientId,
      reconciliationType: dto.reconciliationType,
      source: dto.source,
      discrepanciesFound: medicationsNeedingReview.length,
      discrepanciesResolved: 0,
      notes: dto.notes,
      reconciledById: userId,
    });

    const savedLog = await reconciliationRepository.save(reconciliationLog);

    if (dto.medicationIds?.length) {
      await medicationRepository.update(dto.medicationIds, {
        reconciliationStatus: ReconciliationStatus.VERIFIED,
      });
    }

    return {
      id: savedLog.id,
      discrepanciesFound: medicationsNeedingReview.length,
      discrepanciesResolved: dto.medicationIds?.length || 0,
      medicationsNeedingReview: medicationsNeedingReview.map((med) => ({
        id: med.id,
        medicationName: med.medicationName,
        dosage: med.dosage,
        frequency: med.frequency,
        reconciliationStatus: med.reconciliationStatus,
        reconciliationNotes: med.reconciliationNotes,
      })),
      medicationsVerified: medicationsVerified.map((med) => ({
        id: med.id,
        medicationName: med.medicationName,
        dosage: med.dosage,
        frequency: med.frequency,
      })),
    };
  }

  async getReconciliationHistory(
    tenantDb: DataSource,
    patientId: string,
  ): Promise<MedicationReconciliationLog[]> {
    const repository = this.reconciliationRepository(tenantDb);
    return repository.find({
      where: { patientId },
      order: { reconciliationDate: 'DESC' },
    });
  }

  async getMedicationTimeline(tenantDb: DataSource, patientId: string) {
    const medications = await this.getMedications(tenantDb, patientId);
    const adherenceRecords = await this.adherenceRepository(tenantDb).find({
      where: { patientId },
      order: { adherenceDate: 'DESC' },
      take: 50,
    });
    const reconciliationLogs = await this.getReconciliationHistory(tenantDb, patientId);

    const timeline: any[] = [];

    medications.forEach((med) => {
      timeline.push({
        id: med.id,
        entity: 'medication',
        date: med.startDate || med.createdAt,
        title: med.medicationName,
        subtitle: `${med.dosage || ''} ${med.frequency || ''}`.trim(),
        status: med.status,
        medicationType: med.medicationType,
        endDate: med.endDate,
        notes: med.notes,
      });

      if (med.endDate) {
        timeline.push({
          id: `${med.id}-end`,
          entity: 'medication-end',
          date: med.endDate,
          title: `${med.medicationName} ${med.status === MedicationStatus.DISCONTINUED ? 'discontinued' : 'completed'}`,
          subtitle: med.reasonForDiscontinuation,
          status: med.status,
          medicationType: med.medicationType,
        });
      }
    });

    adherenceRecords.forEach((record) => {
      timeline.push({
        id: record.id,
        entity: 'adherence',
        date: record.adherenceDate,
        title: record.taken ? 'Dose Taken' : 'Dose Missed',
        subtitle: record.notes || record.missedReason,
        medicationId: record.medicationId,
        status: record.taken ? 'taken' : 'missed',
      });
    });

    reconciliationLogs.forEach((log) => {
      timeline.push({
        id: log.id,
        entity: 'reconciliation',
        date: log.reconciliationDate,
        title: `Medication Reconciliation (${log.reconciliationType.replace('_', ' ')})`,
        subtitle: `${log.discrepanciesFound} discrepancies found` +
          (log.discrepanciesResolved ? `, ${log.discrepanciesResolved} resolved` : ''),
        notes: log.notes,
      });
    });

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
