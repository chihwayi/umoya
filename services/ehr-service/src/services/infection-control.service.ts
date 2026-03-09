import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InfectionSurveillance } from '../entities/infection-surveillance.entity';
import { IsolationPrecaution } from '../entities/isolation-precaution.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';

@Injectable()
export class InfectionControlService {
  private readonly logger = new Logger(InfectionControlService.name);

  constructor() {}

  // ==================== INFECTION SURVEILLANCE ====================

  async reportInfection(
    infectionData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const infection = repository.create({
      ...infectionData,
      detectedById: userId,
      detectedDate: new Date(),
    });

    return await repository.save(infection) as unknown as InfectionSurveillance;
  }

  async getInfectionsByDateRange(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance[]> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    return await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .leftJoinAndSelect('infection.patient', 'patient')
      .leftJoinAndSelect('infection.detectedBy', 'detectedBy')
      .orderBy('infection.infectionDate', 'DESC')
      .getMany();
  }

  async getHAIMetrics(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const haiCases = await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .andWhere('infection.onsetType = :onsetType', { onsetType: 'hospital_acquired' })
      .getMany();

    const byType = haiCases.reduce((acc: any, infection) => {
      acc[infection.infectionType] = (acc[infection.infectionType] || 0) + 1;
      return acc;
    }, {});

    return {
      totalHAI: haiCases.length,
      byType,
      deviceAssociated: haiCases.filter(i => i.deviceAssociated).length,
    };
  }

  // ==================== ISOLATION PRECAUTIONS ====================

  async orderIsolation(
    isolationData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = repository.create({
      ...isolationData,
      orderedById: userId,
      startDate: new Date(),
      status: 'active',
    });

    return await repository.save(isolation) as unknown as IsolationPrecaution;
  }

  async getActiveIsolations(
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution[]> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    return await repository.find({
      where: { status: 'active' },
      relations: ['patient', 'orderedBy'],
      order: { startDate: 'DESC' },
    });
  }

  async discontinueIsolation(
    id: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = await repository.findOne({ where: { id } });
    if (!isolation) {
      throw new NotFoundException('Isolation precaution not found');
    }

    isolation.status = 'discontinued';
    isolation.endDate = new Date();
    isolation.discontinuedById = userId;
    isolation.discontinuationReason = reason;

    return await repository.save(isolation);
  }

  // ==================== ANTIMICROBIAL STEWARDSHIP ====================

  async trackAntibiotic(
    stewardshipData: any,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = repository.create(stewardshipData);
    return await repository.save(stewardship) as unknown as AntimicrobialStewardship;
  }

  async getAntibioticUsageReport(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const usage = await repository
      .createQueryBuilder('stewardship')
      .where('stewardship.startDate >= :startDate', { startDate })
      .andWhere('stewardship.startDate <= :endDate', { endDate })
      .getMany();

    const byAntibiotic = usage.reduce((acc: any, item) => {
      acc[item.antibioticName] = (acc[item.antibioticName] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPrescriptions: usage.length,
      byAntibiotic,
      empiric: usage.filter(u => u.empiricOrTargeted === 'empiric').length,
      targeted: usage.filter(u => u.empiricOrTargeted === 'targeted').length,
    };
  }

  async reviewAntibiotic(
    id: string,
    reviewData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = await repository.findOne({ where: { id } });
    if (!stewardship) {
      throw new NotFoundException('Antibiotic record not found');
    }

    stewardship.reviewDate = new Date();
    stewardship.reviewedById = userId;
    stewardship.stewardshipRecommendation = reviewData.recommendation;
    stewardship.appropriateIndication = reviewData.appropriateIndication;
    stewardship.appropriateDose = reviewData.appropriateDose;
    stewardship.appropriateDuration = reviewData.appropriateDuration;
    stewardship.deEscalationOpportunity = reviewData.deEscalationOpportunity;
    stewardship.deEscalationNotes = reviewData.deEscalationNotes;

    return await repository.save(stewardship);
  }

  // ==================== HAND HYGIENE ====================

  async recordHandHygiene(data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO hand_hygiene_observations (observer_id, observed_staff_id, department, opportunity_type, hand_hygiene_performed, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId,
        data.observedStaffId ?? null,
        data.department ?? null,
        data.opportunityType,
        data.handHygienePerformed ?? false,
        data.method ?? null,
        data.notes ?? null,
      ],
    );
    return row;
  }

  async getHandHygieneCompliance(startDate: Date, endDate: Date, department: string | null, tenantDb: DataSource): Promise<any> {
    let query = `
      SELECT department, opportunity_type,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE hand_hygiene_performed)::int as performed
      FROM hand_hygiene_observations
      WHERE observation_date >= $1 AND observation_date <= $2
    `;
    const params: any[] = [startDate, endDate];
    if (department) {
      query += ` AND department = $3`;
      params.push(department);
    }
    query += ` GROUP BY department, opportunity_type`;
    const rows = await tenantDb.query(query, params);
    return rows.map((r: any) => ({
      department: r.department,
      opportunityType: r.opportunity_type,
      total: Number(r.total),
      performed: Number(r.performed),
      complianceRate: r.total > 0 ? Number((r.performed / r.total * 100).toFixed(1)) : 0,
    }));
  }

  // ==================== DEVICE DAYS ====================

  async trackDeviceDay(data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO device_day_tracking (patient_id, admission_id, device_type, inserted_date, inserted_by, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.patientId,
        data.admissionId ?? null,
        data.deviceType,
        data.insertedDate || new Date().toISOString().split('T')[0],
        userId,
        data.location ?? null,
        data.notes ?? null,
      ],
    );
    return row;
  }

  async removeDeviceDay(id: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `UPDATE device_day_tracking SET removed_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!row) throw new NotFoundException('Device day record not found');
    return row;
  }

  async getDeviceDayRates(startDate: Date, endDate: Date, tenantDb: DataSource): Promise<any> {
    const deviceDays = await tenantDb.query(
      `SELECT device_type,
        COUNT(*) FILTER (WHERE removed_date IS NULL OR removed_date > $2)::int as device_days
       FROM device_day_tracking
       WHERE inserted_date <= $2 AND (removed_date IS NULL OR removed_date >= $1)
       GROUP BY device_type`,
      [startDate, endDate],
    );
    const infections = await tenantDb.query(
      `SELECT device_type, COUNT(*)::int as cnt FROM infection_surveillance
       WHERE infection_date >= $1 AND infection_date <= $2 AND device_associated = true
       GROUP BY device_type`,
      [startDate, endDate],
    );
    const rates: any = { central_line: { deviceDays: 0, infections: 0, rate: 0 }, urinary_catheter: { deviceDays: 0, infections: 0, rate: 0 }, ventilator: { deviceDays: 0, infections: 0, rate: 0 } };
    for (const row of deviceDays) {
      const key = row.device_type;
      if (rates[key]) rates[key].deviceDays = Number(row.device_days);
    }
    for (const row of infections) {
      const key = row.device_type || 'central_line';
      if (rates[key]) rates[key].infections = Number(row.cnt);
    }
    for (const key of Object.keys(rates)) {
      const d = rates[key].deviceDays || 1;
      rates[key].rate = ((rates[key].infections / d) * 1000).toFixed(2);
    }
    return rates;
  }
}


