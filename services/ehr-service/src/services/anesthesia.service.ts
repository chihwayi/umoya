import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PreAnesthesiaAssessment } from '../entities/pre-anesthesia-assessment.entity';
import { AnesthesiaRecord } from '../entities/anesthesia-record.entity';
import { AnesthesiaVitals } from '../entities/anesthesia-vitals.entity';
import { PacuRecord } from '../entities/pacu-record.entity';
import { AnesthesiaBilling } from '../entities/anesthesia-billing.entity';

@Injectable()
export class AnesthesiaService {
  private readonly logger = new Logger(AnesthesiaService.name);

  constructor() {}

  private async hasTable(tenantDb: DataSource, tableName: string): Promise<boolean> {
    const [row] = await tenantDb.query(`SELECT to_regclass($1) as table_name`, [`public.${tableName}`]);
    return Boolean(row?.table_name);
  }

  private async ensureTableForWrite(
    tenantDb: DataSource,
    tableName: string,
    featureDescription: string,
  ): Promise<void> {
    if (await this.hasTable(tenantDb, tableName)) return;
    throw new BadRequestException(
      `${featureDescription} is not initialized for this tenant. Missing table: ${tableName}.`,
    );
  }

  // ==================== PRE-ANESTHESIA ASSESSMENT ====================

  async createPreAnesthesiaAssessment(
    assessmentData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PreAnesthesiaAssessment> {
    const repository = tenantDb.getRepository(PreAnesthesiaAssessment);

    const assessment = repository.create({
      ...assessmentData,
      assessedById: userId,
      assessedAt: new Date(),
    });

    return await repository.save(assessment) as unknown as PreAnesthesiaAssessment;
  }

  async getPreAnesthesiaAssessment(
    caseId: string,
    tenantDb: DataSource,
  ): Promise<PreAnesthesiaAssessment> {
    const repository = tenantDb.getRepository(PreAnesthesiaAssessment);

    const assessment = await repository.findOne({
      where: { surgicalCaseId: caseId },
      relations: ['assessedBy', 'consentObtainedBy'],
    });

    if (!assessment) {
      throw new NotFoundException(`Pre-anesthesia assessment not found for case ${caseId}`);
    }

    return assessment;
  }

  async updatePreAnesthesiaAssessment(
    id: string,
    updateData: any,
    tenantDb: DataSource,
  ): Promise<PreAnesthesiaAssessment> {
    const repository = tenantDb.getRepository(PreAnesthesiaAssessment);

    const assessment = await repository.findOne({ where: { id } });
    if (!assessment) {
      throw new NotFoundException(`Pre-anesthesia assessment ${id} not found`);
    }

    Object.assign(assessment, updateData);
    return await repository.save(assessment);
  }

  // ==================== ANESTHESIA RECORD ====================

  async startAnesthesiaRecord(
    recordData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = repository.create({
      ...recordData,
      anesthesiologistId: recordData.anesthesiologistId || userId,
      anesthesiaStartTime: new Date(),
    });

    return await repository.save(record) as unknown as AnesthesiaRecord;
  }

  async getAnesthesiaRecord(
    caseId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = await repository.findOne({
      where: { surgicalCaseId: caseId },
      relations: ['anesthesiologist', 'crna'],
    });

    if (!record) {
      throw new NotFoundException(`Anesthesia record not found for case ${caseId}`);
    }

    return record;
  }

  async updateAnesthesiaRecord(
    id: string,
    updateData: any,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = await repository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Anesthesia record ${id} not found`);
    }

    Object.assign(record, updateData);
    return await repository.save(record);
  }

  async completeAnesthesiaRecord(
    id: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = await repository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Anesthesia record ${id} not found`);
    }

    record.anesthesiaEndTime = new Date();
    return await repository.save(record);
  }

  // ==================== ANESTHESIA VITALS ====================

  async recordVitals(
    recordId: string,
    vitalsData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaVitals> {
    const repository = tenantDb.getRepository(AnesthesiaVitals);

    const vitals = repository.create({
      anesthesiaRecordId: recordId,
      ...vitalsData,
      recordedById: userId,
      chartTime: vitalsData.chartTime || new Date(),
    });

    return await repository.save(vitals) as unknown as AnesthesiaVitals;
  }

  async getVitalsByRecord(
    recordId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaVitals[]> {
    const repository = tenantDb.getRepository(AnesthesiaVitals);

    return await repository.find({
      where: { anesthesiaRecordId: recordId },
      order: { chartTime: 'ASC' },
      relations: ['recordedBy'],
    });
  }

  async recordMedication(
    recordId: string,
    medicationData: any,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = await repository.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException(`Anesthesia record ${recordId} not found`);
    }

    const medications = record.medicationsAdministered || [];
    medications.push({
      ...medicationData,
      time: new Date().toISOString(),
    });

    record.medicationsAdministered = medications;
    return await repository.save(record);
  }

  async recordEvent(
    recordId: string,
    eventData: any,
    tenantDb: DataSource,
  ): Promise<AnesthesiaRecord> {
    const repository = tenantDb.getRepository(AnesthesiaRecord);

    const record = await repository.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException(`Anesthesia record ${recordId} not found`);
    }

    const events = record.intraopEvents || [];
    events.push({
      ...eventData,
      time: new Date().toISOString(),
    });

    record.intraopEvents = events;
    return await repository.save(record);
  }

  // ==================== PACU ====================

  async admitToPACU(
    pacuData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PacuRecord> {
    await this.ensureTableForWrite(tenantDb, 'pacu_records', 'PACU admissions');

    const repository = tenantDb.getRepository(PacuRecord);

    const pacuRecord = repository.create({
      ...pacuData,
      pacuNurseId: userId,
      arrivalTime: new Date(),
    });

    return await repository.save(pacuRecord) as unknown as PacuRecord;
  }

  async getPACURecord(
    id: string,
    tenantDb: DataSource,
  ): Promise<PacuRecord> {
    if (!(await this.hasTable(tenantDb, 'pacu_records'))) {
      throw new BadRequestException(
        'PACU is not initialized for this tenant. Missing table: pacu_records.',
      );
    }

    const repository = tenantDb.getRepository(PacuRecord);

    let record: PacuRecord | null = null;
    try {
      record = await repository.findOne({
        where: { id },
        relations: ['pacuNurse', 'dischargeApprovedBy'],
      });
    } catch {
      record = await repository.findOne({ where: { id } });
    }

    if (!record) {
      throw new NotFoundException(`PACU record ${id} not found`);
    }

    return record;
  }

  async updateAldreteScore(
    id: string,
    scoreData: any,
    tenantDb: DataSource,
  ): Promise<PacuRecord> {
    await this.ensureTableForWrite(tenantDb, 'pacu_records', 'PACU Aldrete scoring');

    const repository = tenantDb.getRepository(PacuRecord);

    const record = await repository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`PACU record ${id} not found`);
    }

    Object.assign(record, scoreData);
    
    // Check if ready for discharge (Aldrete ≥ 9)
    if (scoreData.aldreteScoreDischarge >= 9) {
      record.dischargeCriteriaMet = true;
    }

    return await repository.save(record);
  }

  async dischargePACU(
    id: string,
    dischargeData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PacuRecord> {
    await this.ensureTableForWrite(tenantDb, 'pacu_records', 'PACU discharge');

    const repository = tenantDb.getRepository(PacuRecord);

    const record = await repository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`PACU record ${id} not found`);
    }

    if (!record.dischargeCriteriaMet) {
      throw new Error('Discharge criteria not met. Aldrete score must be ≥9');
    }

    record.dischargeTime = new Date();
    record.dischargedTo = dischargeData.dischargedTo;
    record.dischargeApprovedById = userId;

    return await repository.save(record);
  }

  async getActivePACUPatients(
    tenantDb: DataSource,
  ): Promise<PacuRecord[]> {
    if (!(await this.hasTable(tenantDb, 'pacu_records'))) {
      this.logger.warn('PACU active list requested but pacu_records table is missing. Returning empty list.');
      return [];
    }

    const repository = tenantDb.getRepository(PacuRecord);

    try {
      return await repository.find({
        where: { dischargeTime: null },
        relations: ['patient', 'pacuNurse', 'surgicalCase'],
        order: { arrivalTime: 'ASC' },
      });
    } catch (relationError: any) {
      this.logger.warn(
        `PACU active list relation query failed. Falling back to base query. ${relationError?.message ?? relationError}`,
      );

      try {
        return await repository.find({
          where: { dischargeTime: null },
          order: { arrivalTime: 'ASC' },
        });
      } catch (baseQueryError: any) {
        this.logger.warn(
          `PACU active list base query failed; returning empty list for compatibility. ${baseQueryError?.message ?? baseQueryError}`,
        );
        return [];
      }
    }
  }

  // ==================== BILLING ====================

  async calculateAnesthesiaBilling(
    caseId: string,
    billingData: any,
    tenantDb: DataSource,
  ): Promise<AnesthesiaBilling> {
    const repository = tenantDb.getRepository(AnesthesiaBilling);

    // Get anesthesia record for time calculation
    const anesthesiaRepository = tenantDb.getRepository(AnesthesiaRecord);
    const anesthesiaRecord = await anesthesiaRepository.findOne({
      where: { surgicalCaseId: caseId },
    });

    if (!anesthesiaRecord) {
      throw new NotFoundException(`Anesthesia record not found for case ${caseId}`);
    }

    // Calculate time units (15-minute increments)
    const startTime = new Date(anesthesiaRecord.anesthesiaStartTime);
    const endTime = new Date(anesthesiaRecord.anesthesiaEndTime);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    const timeUnits = Math.ceil(durationMinutes / 15);

    const billing = repository.create({
      surgicalCaseId: caseId,
      anesthesiaRecordId: anesthesiaRecord.id,
      baseUnits: billingData.baseUnits,
      timeUnits: timeUnits,
      modifyingUnits: billingData.modifyingUnits || 0,
      anesthesiaCptCode: billingData.anesthesiaCptCode,
      modifiers: billingData.modifiers,
      anesthesiaStart: anesthesiaRecord.anesthesiaStartTime,
      anesthesiaEnd: anesthesiaRecord.anesthesiaEndTime,
      conversionFactor: billingData.conversionFactor || 22.00,
      additionalProcedures: billingData.additionalProcedures || [],
      notes: billingData.notes,
    });

    return await repository.save(billing);
  }

  async getAnesthesiaBilling(
    caseId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaBilling> {
    const repository = tenantDb.getRepository(AnesthesiaBilling);

    const billing = await repository.findOne({
      where: { surgicalCaseId: caseId },
      relations: ['billedBy'],
    });

    if (!billing) {
      throw new NotFoundException(`Anesthesia billing not found for case ${caseId}`);
    }

    return billing;
  }

  async markBilled(
    id: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AnesthesiaBilling> {
    const repository = tenantDb.getRepository(AnesthesiaBilling);

    const billing = await repository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException(`Anesthesia billing ${id} not found`);
    }

    billing.billedAt = new Date();
    billing.billedById = userId;

    return await repository.save(billing);
  }
}
