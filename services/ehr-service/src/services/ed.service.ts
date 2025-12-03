import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
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

  async getEDTrackingBoard(tenantDb: DataSource): Promise<EDVisit[]> {
    const repository = tenantDb.getRepository(EDVisit);
    return await repository.find({
      where: {
        edStatus: 'waiting' as any, // Active visits
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

  async getEDMetrics(date: Date, tenantDb: DataSource): Promise<any> {
    const [metrics] = await tenantDb.query(
      `
      SELECT 
        COUNT(*) as total_visits,
        AVG(time_to_provider) as avg_door_to_provider,
        AVG(total_ed_time) as avg_total_time,
        COUNT(CASE WHEN triage_level = 1 THEN 1 END) as esi_level_1,
        COUNT(CASE WHEN triage_level = 2 THEN 1 END) as esi_level_2,
        COUNT(CASE WHEN triage_level = 3 THEN 1 END) as esi_level_3,
        COUNT(CASE WHEN triage_level = 4 THEN 1 END) as esi_level_4,
        COUNT(CASE WHEN triage_level = 5 THEN 1 END) as esi_level_5
      FROM ed_visits
      WHERE DATE(arrival_date) = $1
    `,
      [date],
    );

    return metrics;
  }
}

