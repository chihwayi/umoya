import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OperatingRoom } from '../entities/operating-room.entity';
import { SurgicalCase } from '../entities/surgical-case.entity';
import { SurgicalImplant } from '../entities/surgical-implant.entity';

@Injectable()
export class OperatingRoomService {
  private readonly logger = new Logger(OperatingRoomService.name);

  async getOperatingRooms(filters: any, tenantDb: DataSource): Promise<OperatingRoom[]> {
    const repository = tenantDb.getRepository(OperatingRoom);
    const queryBuilder = repository.createQueryBuilder('or');

    if (filters.roomType) {
      queryBuilder.andWhere('or.roomType = :roomType', { roomType: filters.roomType });
    }

    if (filters.status) {
      queryBuilder.andWhere('or.status = :status', { status: filters.status });
    }

    if (typeof filters.isActive !== 'undefined') {
      queryBuilder.andWhere('or.isActive = :isActive', { isActive: filters.isActive });
    }

    queryBuilder.orderBy('or.roomNumber', 'ASC');

    return await queryBuilder.getMany();
  }

  async getORById(orId: string, tenantDb: DataSource): Promise<OperatingRoom> {
    const repository = tenantDb.getRepository(OperatingRoom);
    const or = await repository.findOne({ where: { id: orId } });

    if (!or) {
      throw new NotFoundException(`Operating room not found: ${orId}`);
    }

    return or;
  }

  async getORAvailability(date: Date, tenantDb: DataSource): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    
    const query = `
      SELECT 
        or_rooms.id,
        or_rooms.room_number,
        or_rooms.room_name,
        or_rooms.room_type,
        or_rooms.status,
        json_agg(
          json_build_object(
            'caseId', sc.id,
            'caseNumber', sc.case_number,
            'patientName', p.first_name || ' ' || p.last_name,
            'procedureName', sc.procedure_name,
            'scheduledStartTime', sc.scheduled_start_time,
            'scheduledEndTime', sc.scheduled_end_time,
            'surgeonName', u.first_name || ' ' || u.last_name,
            'status', sc.status
          ) ORDER BY sc.scheduled_start_time
        ) FILTER (WHERE sc.id IS NOT NULL) as scheduled_cases
      FROM operating_rooms or_rooms
      LEFT JOIN surgical_cases sc ON sc.operating_room_id = or_rooms.id 
        AND sc.scheduled_date = $1
        AND sc.status NOT IN ('cancelled', 'completed')
      LEFT JOIN patients p ON sc.patient_id = p.id
      LEFT JOIN users u ON sc.primary_surgeon_id = u.id
      WHERE or_rooms.is_active = true
      GROUP BY or_rooms.id, or_rooms.room_number, or_rooms.room_name, or_rooms.room_type, or_rooms.status
      ORDER BY or_rooms.room_number
    `;

    return await tenantDb.query(query, [dateStr]);
  }

  async scheduleSurgicalCase(caseData: any, userId: string, tenantDb: DataSource): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);

    // Generate case number
    const caseNumber = await this.generateCaseNumber(tenantDb);

    // Verify OR availability
    if (caseData.operatingRoomId) {
      const isAvailable = await this.checkORAvailability(
        caseData.operatingRoomId,
        caseData.scheduledDate,
        caseData.scheduledStartTime,
        caseData.scheduledEndTime,
        tenantDb,
      );

      if (!isAvailable) {
        throw new BadRequestException('Operating room is not available at the requested time');
      }
    }

    const surgicalCase = repository.create({
      caseNumber,
      patientId: caseData.patientId,
      appointmentId: caseData.appointmentId,
      admissionId: caseData.admissionId,
      operatingRoomId: caseData.operatingRoomId,
      scheduledDate: caseData.scheduledDate,
      scheduledStartTime: caseData.scheduledStartTime,
      scheduledEndTime: caseData.scheduledEndTime,
      procedureName: caseData.procedureName,
      procedureCodeCpt: caseData.procedureCodeCpt,
      procedureCodeSnomed: caseData.procedureCodeSnomed,
      procedureType: caseData.procedureType || 'elective',
      surgicalApproach: caseData.surgicalApproach,
      laterality: caseData.laterality,
      primaryDiagnosis: caseData.primaryDiagnosis,
      primaryDiagnosisIcd10: caseData.primaryDiagnosisIcd10,
      primaryDiagnosisSnomed: caseData.primaryDiagnosisSnomed,
      secondaryDiagnoses: caseData.secondaryDiagnoses || [],
      primarySurgeonId: caseData.primarySurgeonId,
      assistantSurgeonId: caseData.assistantSurgeonId,
      anesthesiologistId: caseData.anesthesiologistId,
      scrubNurseId: caseData.scrubNurseId,
      circulatingNurseId: caseData.circulatingNurseId,
      additionalStaff: caseData.additionalStaff || [],
      casePriority: caseData.casePriority || 3,
      anesthesiaType: caseData.anesthesiaType,
      consentId: caseData.consentId,
      notes: caseData.notes,
      status: 'scheduled',
      createdBy: userId,
    });

    const saved = await repository.save(surgicalCase);
    this.logger.log(`Surgical case scheduled: ${saved.caseNumber} for patient ${saved.patientId}`);

    // Update OR status if scheduled
    if (saved.operatingRoomId) {
      await this.updateORStatus(saved.operatingRoomId, 'occupied', tenantDb);
    }

    return saved;
  }

  async getSurgicalCase(caseId: string, tenantDb: DataSource): Promise<any> {
    const query = `
      SELECT 
        sc.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.date_of_birth as patient_dob,
        p.medical_record_number as patient_mrn,
        surgeon.first_name as surgeon_first_name,
        surgeon.last_name as surgeon_last_name,
        anesthesiologist.first_name as anesthesiologist_first_name,
        anesthesiologist.last_name as anesthesiologist_last_name,
        or_room.room_number,
        or_room.room_name
      FROM surgical_cases sc
      LEFT JOIN patients p ON sc.patient_id = p.id
      LEFT JOIN users surgeon ON sc.primary_surgeon_id = surgeon.id
      LEFT JOIN users anesthesiologist ON sc.anesthesiologist_id = anesthesiologist.id
      LEFT JOIN operating_rooms or_room ON sc.operating_room_id = or_room.id
      WHERE sc.id = $1
    `;

    const results = await tenantDb.query(query, [caseId]);
    
    if (results.length === 0) {
      throw new NotFoundException(`Surgical case not found: ${caseId}`);
    }

    return results[0];
  }

  async updateCaseStatus(
    caseId: string,
    status: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = await repository.findOne({ where: { id: caseId } });

    if (!surgicalCase) {
      throw new NotFoundException('Surgical case not found');
    }

    surgicalCase.status = status;

    // Set actual times based on status
    if (status === 'in_progress' && !surgicalCase.actualStartTime) {
      surgicalCase.actualStartTime = new Date();
      this.logger.log(`Surgical case started: ${surgicalCase.caseNumber}`);
    }

    if (status === 'completed' && !surgicalCase.actualEndTime) {
      surgicalCase.actualEndTime = new Date();
      this.logger.log(`Surgical case completed: ${surgicalCase.caseNumber}`);
      
      // Release OR for cleaning
      if (surgicalCase.operatingRoomId) {
        await this.updateORStatus(surgicalCase.operatingRoomId, 'cleaning', tenantDb);
      }
    }

    return await repository.save(surgicalCase);
  }

  async updateCaseDocumentation(
    caseId: string,
    documentation: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = await repository.findOne({ where: { id: caseId } });

    if (!surgicalCase) {
      throw new NotFoundException('Surgical case not found');
    }

    // Update documentation fields
    if (documentation.findings) surgicalCase.findings = documentation.findings;
    if (documentation.procedurePerformed) surgicalCase.procedurePerformed = documentation.procedurePerformed;
    if (documentation.postOpDiagnosis) surgicalCase.postOpDiagnosis = documentation.postOpDiagnosis;
    if (documentation.complications) surgicalCase.complications = documentation.complications;
    if (documentation.estimatedBloodLoss) surgicalCase.estimatedBloodLoss = documentation.estimatedBloodLoss;
    if (documentation.specimensSent) surgicalCase.specimensSent = documentation.specimensSent;
    if (documentation.drainsPlaced) surgicalCase.drainsPlaced = documentation.drainsPlaced;

    return await repository.save(surgicalCase);
  }

  async trackImplant(implantData: any, userId: string, tenantDb: DataSource): Promise<any> {
    const repository = tenantDb.getRepository(SurgicalImplant);

    const implant = repository.create({
      surgicalCaseId: implantData.surgicalCaseId,
      implantName: implantData.implantName,
      implantType: implantData.implantType,
      manufacturer: implantData.manufacturer,
      catalogNumber: implantData.catalogNumber,
      lotNumber: implantData.lotNumber,
      serialNumber: implantData.serialNumber,
      expirationDate: implantData.expirationDate,
      udi: implantData.udi,
      udiDi: implantData.udiDi,
      udiPi: implantData.udiPi,
      chargeCode: implantData.chargeCode,
      unitCost: implantData.unitCost,
      billable: implantData.billable !== false,
      implantedBy: userId,
      bodySite: implantData.bodySite,
      notes: implantData.notes,
    });

    const saved = await repository.save(implant);
    this.logger.log(`Implant tracked: ${saved.implantName} (UDI: ${saved.udi})`);

    return saved;
  }

  async getCaseImplants(caseId: string, tenantDb: DataSource): Promise<SurgicalImplant[]> {
    const repository = tenantDb.getRepository(SurgicalImplant);
    return await repository.find({
      where: { surgicalCaseId: caseId },
      order: { createdAt: 'ASC' },
    });
  }

  async getSurgicalCasesByDate(date: Date, tenantDb: DataSource): Promise<any[]> {
    const dateStr = date.toISOString().split('T')[0];
    
    const query = `
      SELECT 
        sc.id,
        sc.case_number,
        sc.procedure_name,
        sc.scheduled_start_time,
        sc.scheduled_end_time,
        sc.status,
        sc.case_priority,
        p.first_name || ' ' || p.last_name as patient_name,
        surgeon.first_name || ' ' || surgeon.last_name as surgeon_name,
        or_room.room_number,
        or_room.room_name
      FROM surgical_cases sc
      LEFT JOIN patients p ON sc.patient_id = p.id
      LEFT JOIN users surgeon ON sc.primary_surgeon_id = surgeon.id
      LEFT JOIN operating_rooms or_room ON sc.operating_room_id = or_room.id
      WHERE sc.scheduled_date = $1
      ORDER BY sc.scheduled_start_time
    `;

    return await tenantDb.query(query, [dateStr]);
  }

  async getORMetrics(startDate: Date, endDate: Date, tenantDb: DataSource): Promise<any> {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    const query = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_cases,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_cases,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_cases,
        AVG(EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))/60) FILTER (WHERE actual_end_time IS NOT NULL) as avg_case_duration_minutes,
        AVG(estimated_blood_loss) FILTER (WHERE estimated_blood_loss IS NOT NULL) as avg_blood_loss_ml,
        COUNT(DISTINCT operating_room_id) as rooms_utilized,
        COUNT(DISTINCT primary_surgeon_id) as surgeons_active
      FROM surgical_cases
      WHERE scheduled_date BETWEEN $1 AND $2
    `;

    const result = await tenantDb.query(query, [startStr, endStr]);
    return result[0];
  }

  async updateORStatus(orId: string, status: string, tenantDb: DataSource): Promise<void> {
    const repository = tenantDb.getRepository(OperatingRoom);
    await repository.update(orId, { status });
    this.logger.log(`OR ${orId} status updated to: ${status}`);
  }

  private async generateCaseNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM surgical_cases WHERE case_number LIKE 'SUR-%'`,
    );
    const count = parseInt(result.count) + 1;
    return `SUR-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  private async checkORAvailability(
    orId: string,
    date: Date,
    startTime: string,
    endTime: string,
    tenantDb: DataSource,
  ): Promise<boolean> {
    const dateStr = date.toISOString ? date.toISOString().split('T')[0] : date;
    
    const query = `
      SELECT COUNT(*) as conflicts
      FROM surgical_cases
      WHERE operating_room_id = $1
        AND scheduled_date = $2
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (scheduled_start_time, scheduled_end_time) OVERLAPS ($3::time, $4::time)
        )
    `;

    const [result] = await tenantDb.query(query, [orId, dateStr, startTime, endTime]);
    return result.conflicts === '0';
  }

  async cancelCase(
    caseId: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = await repository.findOne({ where: { id: caseId } });

    if (!surgicalCase) {
      throw new NotFoundException('Surgical case not found');
    }

    if (surgicalCase.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed case');
    }

    surgicalCase.status = 'cancelled';
    surgicalCase.caseCancelledReason = reason;

    // Release OR
    if (surgicalCase.operatingRoomId) {
      await this.updateORStatus(surgicalCase.operatingRoomId, 'available', tenantDb);
    }

    const updated = await repository.save(surgicalCase);
    this.logger.log(`Surgical case cancelled: ${updated.caseNumber}. Reason: ${reason}`);

    return updated;
  }
}

