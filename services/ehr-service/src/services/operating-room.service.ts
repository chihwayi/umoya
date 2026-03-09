import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OperatingRoom } from '../entities/operating-room.entity';
import { SurgicalCase } from '../entities/surgical-case.entity';
import { SurgicalImplant } from '../entities/surgical-implant.entity';
import { SurgicalPreferenceCard } from '../entities/surgical-preference-card.entity';

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

  // --- Safety checklist ---
  async getSafetyChecklist(caseId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `SELECT * FROM surgical_safety_checklists WHERE surgical_case_id = $1 LIMIT 1`,
      [caseId],
    );
    return row || null;
  }

  async updateSafetyChecklistSignIn(caseId: string, body: any, userId: string, tenantDb: DataSource): Promise<any> {
    await this.getSurgicalCase(caseId, tenantDb);
    const [existing] = await tenantDb.query(`SELECT id FROM surgical_safety_checklists WHERE surgical_case_id = $1`, [caseId]);
    const now = new Date();
    if (existing) {
      await tenantDb.query(
        `UPDATE surgical_safety_checklists SET
          sign_in_completed = true, sign_in_completed_at = $1, sign_in_completed_by = $2,
          patient_identity_confirmed = $3, site_marked = $4, consent_confirmed = $5,
          anesthesia_safety_check = $6, known_allergy = $7, allergy_details = $8,
          difficult_airway_risk = $9, aspiration_risk = $10, blood_loss_risk = $11, blood_loss_estimated_ml = $12,
          updated_at = $1
          WHERE surgical_case_id = $13`,
        [
          now, userId,
          body.patientIdentityConfirmed ?? false, body.siteMarked ?? false, body.consentConfirmed ?? false,
          body.anesthesiaSafetyCheck ?? false, body.knownAllergy ?? false, body.allergyDetails ?? null,
          body.difficultAirwayRisk ?? false, body.aspirationRisk ?? false, body.bloodLossRisk ?? false, body.bloodLossEstimatedMl ?? null,
          caseId,
        ],
      );
    } else {
      await tenantDb.query(
        `INSERT INTO surgical_safety_checklists (
          surgical_case_id, sign_in_completed, sign_in_completed_at, sign_in_completed_by,
          patient_identity_confirmed, site_marked, consent_confirmed, anesthesia_safety_check,
          known_allergy, allergy_details, difficult_airway_risk, aspiration_risk, blood_loss_risk, blood_loss_estimated_ml
        ) VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          caseId, now, userId,
          body.patientIdentityConfirmed ?? false, body.siteMarked ?? false, body.consentConfirmed ?? false,
          body.anesthesiaSafetyCheck ?? false, body.knownAllergy ?? false, body.allergyDetails ?? null,
          body.difficultAirwayRisk ?? false, body.aspirationRisk ?? false, body.bloodLossRisk ?? false, body.bloodLossEstimatedMl ?? null,
        ],
      );
    }
    return this.getSafetyChecklist(caseId, tenantDb);
  }

  async updateSafetyChecklistTimeOut(caseId: string, body: any, userId: string, tenantDb: DataSource): Promise<any> {
    await this.getSurgicalCase(caseId, tenantDb);
    const [existing] = await tenantDb.query(`SELECT id FROM surgical_safety_checklists WHERE surgical_case_id = $1`, [caseId]);
    const now = new Date();
    if (existing) {
      await tenantDb.query(
        `UPDATE surgical_safety_checklists SET
          time_out_completed = true, time_out_completed_at = $1, time_out_completed_by = $2,
          team_members_introduced = $3, procedure_confirmed = $4, site_confirmed = $5,
          anticipated_critical_events = $6, antibiotic_prophylaxis_given = $7, antibiotic_time = $8, imaging_displayed = $9,
          updated_at = $1
          WHERE surgical_case_id = $10`,
        [
          now, userId,
          body.teamMembersIntroduced ?? false, body.procedureConfirmed ?? false, body.siteConfirmed ?? false,
          body.anticipatedCriticalEvents ?? null, body.antibioticProphylaxisGiven ?? false,
          body.antibioticProphylaxisGiven ? now : null, body.imagingDisplayed ?? false,
          caseId,
        ],
      );
    } else {
      await tenantDb.query(
        `INSERT INTO surgical_safety_checklists (
          surgical_case_id, time_out_completed, time_out_completed_at, time_out_completed_by,
          team_members_introduced, procedure_confirmed, site_confirmed, anticipated_critical_events,
          antibiotic_prophylaxis_given, antibiotic_time, imaging_displayed
        ) VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          caseId, now, userId,
          body.teamMembersIntroduced ?? false, body.procedureConfirmed ?? false, body.siteConfirmed ?? false,
          body.anticipatedCriticalEvents ?? null, body.antibioticProphylaxisGiven ?? false,
          body.antibioticProphylaxisGiven ? now : null, body.imagingDisplayed ?? false,
        ],
      );
    }
    return this.getSafetyChecklist(caseId, tenantDb);
  }

  async updateSafetyChecklistSignOut(caseId: string, body: any, userId: string, tenantDb: DataSource): Promise<any> {
    await this.getSurgicalCase(caseId, tenantDb);
    const [existing] = await tenantDb.query(`SELECT id FROM surgical_safety_checklists WHERE surgical_case_id = $1`, [caseId]);
    const now = new Date();
    if (existing) {
      await tenantDb.query(
        `UPDATE surgical_safety_checklists SET
          sign_out_completed = true, sign_out_completed_at = $1, sign_out_completed_by = $2,
          procedure_recorded = $3, instrument_sponge_needle_counts_correct = $4, specimen_labelled = $5,
          equipment_issues = $6, key_concerns_recovery = $7, updated_at = $1
          WHERE surgical_case_id = $8`,
        [
          now, userId,
          body.procedureRecorded ?? false, body.instrumentSpongeNeedleCountsCorrect ?? false, body.specimenLabelled ?? false,
          body.equipmentIssues ?? null, body.keyConcernsRecovery ?? null,
          caseId,
        ],
      );
    } else {
      await tenantDb.query(
        `INSERT INTO surgical_safety_checklists (
          surgical_case_id, sign_out_completed, sign_out_completed_at, sign_out_completed_by,
          procedure_recorded, instrument_sponge_needle_counts_correct, specimen_labelled, equipment_issues, key_concerns_recovery
        ) VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8)`,
        [
          caseId, now, userId,
          body.procedureRecorded ?? false, body.instrumentSpongeNeedleCountsCorrect ?? false, body.specimenLabelled ?? false,
          body.equipmentIssues ?? null, body.keyConcernsRecovery ?? null,
        ],
      );
    }
    return this.getSafetyChecklist(caseId, tenantDb);
  }

  // --- Count sheets ---
  async getCountSheets(caseId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM surgical_count_sheets WHERE surgical_case_id = $1 ORDER BY count_type, item_name`,
      [caseId],
    );
  }

  async addCountSheet(caseId: string, body: { countType: string; itemName: string; initialCount: number }, userId: string, tenantDb: DataSource): Promise<any> {
    await this.getSurgicalCase(caseId, tenantDb);
    const validTypes = ['sponge', 'needle', 'instrument', 'other'];
    if (!validTypes.includes(body.countType)) {
      throw new BadRequestException(`countType must be one of: ${validTypes.join(', ')}`);
    }
    const [row] = await tenantDb.query(
      `INSERT INTO surgical_count_sheets (surgical_case_id, count_type, item_name, initial_count, counted_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [caseId, body.countType, body.itemName, body.initialCount, userId],
    );
    return row;
  }

  async verifyCountSheet(sheetId: string, body: { finalCount: number; countCorrect: boolean; discrepancyNote?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `UPDATE surgical_count_sheets SET final_count = $1, count_correct = $2, discrepancy_note = $3, verified_by = $4, count_time = NOW() WHERE id = $5 RETURNING *`,
      [body.finalCount, body.countCorrect, body.discrepancyNote ?? null, userId, sheetId],
    );
    if (!row) throw new NotFoundException(`Count sheet not found: ${sheetId}`);
    return row;
  }

  // --- Specimens ---
  async getSpecimens(caseId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM surgical_specimens WHERE surgical_case_id = $1 ORDER BY collected_at`,
      [caseId],
    );
  }

  async addSpecimen(caseId: string, body: any, userId: string, tenantDb: DataSource): Promise<any> {
    await this.getSurgicalCase(caseId, tenantDb);
    const [row] = await tenantDb.query(
      `INSERT INTO surgical_specimens (surgical_case_id, specimen_type, specimen_source, quantity, fixative, collected_by, pathology_lab_order_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        caseId,
        body.specimenType ?? 'tissue',
        body.specimenSource ?? '',
        body.quantity ?? 1,
        body.fixative ?? 'formalin',
        userId,
        body.pathologyLabOrderId ?? null,
        body.notes ?? null,
      ],
    );
    return row;
  }

  // --- Preference cards ---
  async getPreferenceCards(tenantDb: DataSource): Promise<SurgicalPreferenceCard[]> {
    const repo = tenantDb.getRepository(SurgicalPreferenceCard);
    return repo.find({ where: { isActive: true }, order: { procedureName: 'ASC' } });
  }

  async getPreferenceCardsBySurgeon(surgeonId: string, tenantDb: DataSource): Promise<SurgicalPreferenceCard[]> {
    const repo = tenantDb.getRepository(SurgicalPreferenceCard);
    return repo.find({ where: { surgeonId, isActive: true }, order: { procedureName: 'ASC' } });
  }

  async createPreferenceCard(body: any, userId: string, tenantDb: DataSource): Promise<SurgicalPreferenceCard> {
    const repo = tenantDb.getRepository(SurgicalPreferenceCard);
    const card = repo.create({
      surgeonId: body.surgeonId,
      procedureName: body.procedureName,
      procedureCodeCpt: body.procedureCodeCpt,
      preferredOrType: body.preferredOrType,
      preferredPosition: body.preferredPosition,
      preferredAnesthesia: body.preferredAnesthesia,
      requiredEquipment: body.requiredEquipment ?? [],
      preferredInstruments: body.preferredInstruments ?? [],
      suturePreferences: body.suturePreferences ?? [],
      supplyList: body.supplyList ?? [],
      implantOptions: body.implantOptions ?? [],
      preferredScrubTech: body.preferredScrubTech,
      specialInstructions: body.specialInstructions,
    });
    return repo.save(card);
  }

  async updatePreferenceCard(id: string, body: any, tenantDb: DataSource): Promise<SurgicalPreferenceCard> {
    const repo = tenantDb.getRepository(SurgicalPreferenceCard);
    const card = await repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException(`Preference card not found: ${id}`);
    if (body.procedureName != null) card.procedureName = body.procedureName;
    if (body.procedureCodeCpt != null) card.procedureCodeCpt = body.procedureCodeCpt;
    if (body.preferredOrType != null) card.preferredOrType = body.preferredOrType;
    if (body.preferredPosition != null) card.preferredPosition = body.preferredPosition;
    if (body.preferredAnesthesia != null) card.preferredAnesthesia = body.preferredAnesthesia;
    if (body.requiredEquipment != null) card.requiredEquipment = body.requiredEquipment;
    if (body.preferredInstruments != null) card.preferredInstruments = body.preferredInstruments;
    if (body.suturePreferences != null) card.suturePreferences = body.suturePreferences;
    if (body.supplyList != null) card.supplyList = body.supplyList;
    if (body.implantOptions != null) card.implantOptions = body.implantOptions;
    if (body.preferredScrubTech != null) card.preferredScrubTech = body.preferredScrubTech;
    if (body.specialInstructions != null) card.specialInstructions = body.specialInstructions;
    if (body.isActive != null) card.isActive = body.isActive;
    return repo.save(card);
  }
}

