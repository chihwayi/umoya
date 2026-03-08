import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Not, In } from 'typeorm';
import { EDVisit } from '../entities/ed-visit.entity';

@Injectable()
export class EDService {
  private readonly logger = new Logger(EDService.name);

  private async generateEDVisitNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM ed_visits WHERE ed_visit_number LIKE 'ED-%'`,
    );
    const count = parseInt(result.count) + 1;
    return `ED-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  async registerEDVisit(
    visitData: {
      patientId: string;
      arrivalMode: string;
      chiefComplaint: string;
      chiefComplaintSnomed?: string;
      presentingSymptoms?: string;
      allergies?: string;
      currentMedications?: string;
      vitalSigns?: any;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<EDVisit> {
    const repository = tenantDb.getRepository(EDVisit);

    const edVisitNumber = await this.generateEDVisitNumber(tenantDb);
    const now = new Date();

    const visit = repository.create({
      ...visitData,
      edVisitNumber,
      arrivalDate: now,
      arrivalTime: now,
      edStatus: 'waiting',
    });

    const saved = await repository.save(visit);

    this.logger.log(`ED visit registered: ${saved.edVisitNumber} for patient ${visitData.patientId}`);

    return saved;
  }

  async triagePatient(
    visitId: string,
    triageData: {
      triageLevel: number;
      vitalSigns: any;
      chiefComplaintSnomed?: string;
      symptoms?: any[];
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<EDVisit> {
    const repository = tenantDb.getRepository(EDVisit);
    const visit = await repository.findOne({ where: { id: visitId } });

    if (!visit) {
      throw new NotFoundException(`ED visit not found: ${visitId}`);
    }

    visit.triageLevel = triageData.triageLevel;
    visit.triageCompletedAt = new Date();
    visit.triageCompletedBy = userId;
    visit.vitalSigns = triageData.vitalSigns;
    visit.chiefComplaintSnomed = triageData.chiefComplaintSnomed;
    visit.edStatus = 'triage';

    // Calculate time to triage
    const arrivalTime = new Date(visit.arrivalTime);
    const triageTime = new Date();
    visit.timeToProvider = Math.floor((triageTime.getTime() - arrivalTime.getTime()) / (1000 * 60));

    // Set acuity based on ESI level
    visit.triageAcuity = this.getAcuityFromESI(triageData.triageLevel);

    const updated = await repository.save(visit);

    // Create triage assessment record
    await tenantDb.query(
      `
      INSERT INTO ed_triage_assessments (
        ed_visit_id, patient_id, triage_date, triaged_by, esi_level,
        temperature, heart_rate, respiratory_rate, blood_pressure_systolic,
        blood_pressure_diastolic, oxygen_saturation, presenting_complaint
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        visitId,
        visit.patientId,
        userId,
        triageData.triageLevel,
        triageData.vitalSigns?.temperature,
        triageData.vitalSigns?.heartRate,
        triageData.vitalSigns?.respiratoryRate,
        triageData.vitalSigns?.bloodPressureSystolic,
        triageData.vitalSigns?.bloodPressureDiastolic,
        triageData.vitalSigns?.oxygenSaturation,
        visit.chiefComplaint,
      ],
    );

    this.logger.log(`ED patient triaged: ${visit.edVisitNumber}, ESI Level ${triageData.triageLevel}`);

    return updated;
  }

  private getAcuityFromESI(level: number): string {
    switch (level) {
      case 1: return 'immediate';
      case 2: return 'emergent';
      case 3: return 'urgent';
      case 4: return 'less_urgent';
      case 5: return 'non_urgent';
      default: return 'unknown';
    }
  }

  private static readonly DISCHARGED_STATUSES = [
    'discharged',
    'admitted',
    'transferred',
    'left_ama',
    'left_without_being_seen',
    'expired',
  ];

  async getEDTrackingBoard(tenantDb: DataSource): Promise<EDVisit[]> {
    const repository = tenantDb.getRepository(EDVisit);
    return await repository.find({
      where: {
        edStatus: Not(In(EDService.DISCHARGED_STATUSES)),
      },
      relations: ['patient', 'attendingProviderUser', 'primaryNurseUser'],
      order: { triageLevel: 'ASC', arrivalTime: 'ASC' },
    });
  }

  async updateEDStatus(
    visitId: string,
    newStatus: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<EDVisit> {
    const repository = tenantDb.getRepository(EDVisit);
    const visit = await repository.findOne({ where: { id: visitId } });

    if (!visit) {
      throw new NotFoundException(`ED visit not found: ${visitId}`);
    }

    visit.edStatus = newStatus;

    // Track time metrics
    if (newStatus === 'discharged' || newStatus === 'admitted') {
      const arrivalTime = new Date(visit.arrivalTime);
      const dispositionTime = new Date();
      visit.totalEdTime = Math.floor((dispositionTime.getTime() - arrivalTime.getTime()) / (1000 * 60));
      visit.dispositionTime = dispositionTime;
    }

    return await repository.save(visit);
  }

  private static readonly DISPOSITION_TYPES = [
    'discharge',
    'admit',
    'transfer',
    'ama',
    'lwbs',
    'expired',
  ];

  async completeDisposition(
    tenantDb: DataSource,
    visitId: string,
    body: {
      disposition?: string;
      dischargeDiagnosis?: string;
      dischargeDiagnosisIcd10?: string;
      dischargeInstructions?: string;
      notes?: string;
    },
    userId?: string,
  ): Promise<EDVisit> {
    const repository = tenantDb.getRepository(EDVisit);
    const visit = await repository.findOne({ where: { id: visitId }, relations: ['patient'] });
    if (!visit) {
      throw new NotFoundException(`ED visit not found: ${visitId}`);
    }

    const raw = (body.disposition || '').toLowerCase();
    const dispositionMap: Record<string, string> = {
      discharge: 'discharged',
      admit: 'admitted',
      transfer: 'transferred',
      ama: 'left_ama',
      lwbs: 'left_without_being_seen',
      expired: 'expired',
    };
    const edStatus = dispositionMap[raw];
    if (!edStatus) {
      throw new BadRequestException(
        `Invalid disposition. Must be one of: ${EDService.DISPOSITION_TYPES.join(', ')}`,
      );
    }

    const now = new Date();
    const arrivalTime = new Date(visit.arrivalTime);
    const totalEdTimeMinutes = Math.floor((now.getTime() - arrivalTime.getTime()) / (1000 * 60));

    visit.disposition = body.disposition || raw;
    visit.dispositionTime = now;
    visit.dischargeDiagnosis = body.dischargeDiagnosis ?? visit.dischargeDiagnosis;
    visit.dischargeDiagnosisIcd10 = body.dischargeDiagnosisIcd10 ?? visit.dischargeDiagnosisIcd10;
    visit.dischargeInstructions = body.dischargeInstructions ?? visit.dischargeInstructions;
    visit.notes = body.notes ?? visit.notes;
    visit.totalEdTime = totalEdTimeMinutes;
    visit.edStatus = edStatus;
    if (edStatus === 'left_ama') {
      visit.leftAma = true;
    }

    const saved = await repository.save(visit);

    if (edStatus === 'admitted') {
      // TODO: trigger bed management admission when service exists
      this.logger.log(`ED visit ${visit.edVisitNumber} admitted; bed assignment TBD`);
    }

    this.logger.log(`ED disposition completed: ${visit.edVisitNumber} -> ${edStatus}`);
    return saved;
  }

  async getEDMetrics(date: Date, tenantDb: DataSource): Promise<any> {
    const [dayRow] = await tenantDb.query(
      `
      SELECT 
        COUNT(*)::int as total_visits,
        COALESCE(AVG(time_to_provider), 0)::numeric as avg_door_to_provider,
        COALESCE(AVG(total_ed_time), 0)::numeric as avg_total_time,
        COUNT(CASE WHEN ed_status = 'left_without_being_seen' OR left_ama THEN 1 END)::int as lwbs_count,
        COUNT(CASE WHEN triage_level = 1 THEN 1 END)::int as esi_1,
        COUNT(CASE WHEN triage_level = 2 THEN 1 END)::int as esi_2,
        COUNT(CASE WHEN triage_level = 3 THEN 1 END)::int as esi_3,
        COUNT(CASE WHEN triage_level = 4 THEN 1 END)::int as esi_4,
        COUNT(CASE WHEN triage_level = 5 THEN 1 END)::int as esi_5,
        COUNT(CASE WHEN ed_status = 'admitted' THEN 1 END)::int as admitted_count
      FROM ed_visits
      WHERE DATE(arrival_date) = $1
    `,
      [date],
    );

    const [censusRow] = await tenantDb.query(
      `
      SELECT COUNT(*)::int as current_census
      FROM ed_visits
      WHERE ed_status NOT IN ($1, $2, $3, $4, $5, $6)
    `,
      [...EDService.DISCHARGED_STATUSES],
    );

    const total = Number(dayRow?.total_visits ?? 0) || 1;
    const lwbsCount = Number(dayRow?.lwbs_count ?? 0);
    const admissionRate = total ? Number(dayRow?.admitted_count ?? 0) / total : 0;

    return {
      total_visits_today: Number(dayRow?.total_visits ?? 0),
      current_census: Number(censusRow?.current_census ?? 0),
      average_wait_time_minutes: Number(dayRow?.avg_door_to_provider ?? 0),
      average_door_to_provider_minutes: Number(dayRow?.avg_door_to_provider ?? 0),
      lwbs_count: lwbsCount,
      lwbs_rate: total ? lwbsCount / total : 0,
      admission_rate: admissionRate,
      esi_level_1: Number(dayRow?.esi_1 ?? 0),
      esi_level_2: Number(dayRow?.esi_2 ?? 0),
      esi_level_3: Number(dayRow?.esi_3 ?? 0),
      esi_level_4: Number(dayRow?.esi_4 ?? 0),
      esi_level_5: Number(dayRow?.esi_5 ?? 0),
    };
  }
}

