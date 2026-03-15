import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Immunization } from '../entities/immunization.entity';
import { VaccineInventory } from '../entities/vaccine-inventory.entity';
import { ImmunizationSchedule } from '../entities/immunization-schedule.entity';

@Injectable()
export class ImmunizationService {
  private readonly logger = new Logger(ImmunizationService.name);

  private async generateImmunizationNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM immunizations WHERE immunization_number LIKE 'IMM-%'`,
    );
    const count = parseInt(result.count) + 1;
    return `IMM-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  async recordImmunization(
    immunizationData: {
      patientId: string;
      vaccineCode: string;
      vaccineName: string;
      manufacturer?: string;
      lotNumber?: string;
      expirationDate?: Date;
      administrationDate: Date;
      doseNumber?: number;
      doseQuantity?: number;
      route?: string;
      site?: string;
      orderedBy?: string;
      appointmentId?: string;
      notes?: string;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<Immunization> {
    const repository = tenantDb.getRepository(Immunization);

    // Generate immunization number
    const immunizationNumber = await this.generateImmunizationNumber(tenantDb);

    // Check vaccine inventory if lot number provided
    if (immunizationData.lotNumber) {
      await this.updateInventory(immunizationData.vaccineCode, immunizationData.lotNumber, tenantDb);
    }

    const immunization = repository.create({
      ...immunizationData,
      immunizationNumber,
      administeredBy: userId,
      orderingProvider: immunizationData.orderedBy || userId,
      completionStatus: 'completed',
    });

    const saved = await repository.save(immunization);

    this.logger.log(`Immunization recorded: ${saved.id} for patient ${immunizationData.patientId}`);

    // Schedule registry submission (async)
    this.scheduleRegistrySubmission(saved.id, tenantDb).catch(err =>
      this.logger.error(`Failed to schedule registry submission: ${err.message}`),
    );

    return saved;
  }

  async getSchedules(
    tenantDb: DataSource,
    scheduleType?: 'routine' | 'travel',
  ): Promise<ImmunizationSchedule[]> {
    const repo = tenantDb.getRepository(ImmunizationSchedule);
    const qb = repo
      .createQueryBuilder('s')
      .where('s.isActive = :active', { active: true })
      .orderBy('s.scheduleType', 'ASC')
      .addOrderBy('s.vaccineCode', 'ASC')
      .addOrderBy('s.doseNumber', 'ASC');
    if (scheduleType) {
      qb.andWhere('s.scheduleType = :scheduleType', { scheduleType });
    }
    return qb.getMany();
  }

  async getInventory(
    tenantDb: DataSource,
    vaccineCode?: string,
  ): Promise<VaccineInventory[]> {
    const repo = tenantDb.getRepository(VaccineInventory);
    const qb = repo
      .createQueryBuilder('v')
      .where('v.status = :status', { status: 'active' })
      .orderBy('v.vaccineCode', 'ASC')
      .addOrderBy('v.expirationDate', 'ASC');
    if (vaccineCode) {
      qb.andWhere('v.vaccineCode = :vaccineCode', { vaccineCode });
    }
    return qb.getMany();
  }

  async administerVaccine(
    data: {
      patientId: string;
      vaccineCode: string;
      vaccineName: string;
      lotNumber?: string;
      manufacturer?: string;
      expirationDate?: Date;
      doseNumber?: number;
      doseQuantity?: number;
      route?: string;
      site?: string;
      notes?: string;
      appointmentId?: string;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<Immunization> {
    const administrationDate = new Date();
    return this.recordImmunization(
      {
        patientId: data.patientId,
        vaccineCode: data.vaccineCode,
        vaccineName: data.vaccineName,
        manufacturer: data.manufacturer,
        lotNumber: data.lotNumber,
        expirationDate: data.expirationDate,
        administrationDate,
        doseNumber: data.doseNumber,
        doseQuantity: data.doseQuantity,
        route: data.route,
        site: data.site,
        notes: data.notes,
        appointmentId: data.appointmentId,
      },
      userId,
      tenantDb,
    );
  }

  async getPatientImmunizations(
    patientId: string,
    filters: { vaccineCode?: string; startDate?: Date; endDate?: Date },
    tenantDb: DataSource,
  ): Promise<Immunization[]> {
    const repository = tenantDb.getRepository(Immunization);
    const queryBuilder = repository
      .createQueryBuilder('imm')
      .where('imm.patientId = :patientId', { patientId })
      .leftJoinAndSelect('imm.administeredByUser', 'admin')
      .orderBy('imm.administrationDate', 'DESC');

    if (filters.vaccineCode) {
      queryBuilder.andWhere('imm.vaccineCode = :vaccineCode', {
        vaccineCode: filters.vaccineCode,
      });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('imm.administrationDate >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('imm.administrationDate <= :endDate', {
        endDate: filters.endDate,
      });
    }

    return await queryBuilder.getMany();
  }

  async getImmunizationForecast(
    patientId: string,
    dateOfBirth: Date,
    tenantDb: DataSource,
  ): Promise<any[]> {
    // Calculate patient age in months
    const ageMonths = Math.floor(
      (new Date().getTime() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    );

    // Get patient's immunization history
    const history = await this.getPatientImmunizations(patientId, {}, tenantDb);

    // Get applicable schedules
    const scheduleRepo = tenantDb.getRepository(ImmunizationSchedule);
    const schedules = await scheduleRepo.find({
      where: { isActive: true },
      order: { vaccineCode: 'ASC', doseNumber: 'ASC' },
    });

    // Calculate forecast
    const forecasts = [];

    for (const schedule of schedules) {
      // Check if patient is in age range
      if (schedule.minimumAgeMonths && ageMonths < schedule.minimumAgeMonths) continue;
      if (schedule.maximumAgeMonths && ageMonths > schedule.maximumAgeMonths) continue;

      // Check if dose already given
      const doseGiven = history.find(
        imm => imm.vaccineCode === schedule.vaccineCode && imm.doseNumber === schedule.doseNumber,
      );

      if (!doseGiven) {
        forecasts.push({
          vaccineName: schedule.vaccineName,
          vaccineCode: schedule.vaccineCode,
          doseNumber: schedule.doseNumber,
          status: 'due',
          recommendedDate: this.calculateRecommendedDate(dateOfBirth, schedule.recommendedAgeMonths),
          scheduleType: schedule.scheduleType,
        });
      }
    }

    return forecasts;
  }

  private calculateRecommendedDate(dateOfBirth: Date, ageMonths: number): Date {
    const date = new Date(dateOfBirth);
    date.setMonth(date.getMonth() + ageMonths);
    return date;
  }

  private async updateInventory(vaccineCode: string, lotNumber: string, tenantDb: DataSource): Promise<void> {
    const inventoryRepo = tenantDb.getRepository(VaccineInventory);
    
    const inventory = await inventoryRepo.findOne({
      where: { vaccineCode, lotNumber },
    });

    if (inventory && inventory.quantityRemaining > 0) {
      inventory.quantityRemaining -= 1;
      inventory.quantityAdministered += 1;
      await inventoryRepo.save(inventory);
    } else {
      this.logger.warn(`Vaccine inventory low or not found: ${vaccineCode} lot ${lotNumber}`);
    }
  }

  private async scheduleRegistrySubmission(immunizationId: string, tenantDb: DataSource): Promise<void> {
    // TODO: Implement HL7 v2.5.1 VXU message generation
    // This would integrate with state/national immunization registry
    this.logger.log(`Registry submission scheduled for immunization: ${immunizationId}`);
  }

  async recordAdverseEvent(
    immunizationId: string,
    eventData: {
      eventDate: Date;
      severity: string;
      eventDescription: string;
      treatmentRequired?: boolean;
      hospitalizationRequired?: boolean;
    },
    userId: string,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO vaccine_adverse_events (
        immunization_id, patient_id, event_date, severity,
        event_description, treatment_required, hospitalization_required,
        reported_by
      )
      SELECT $1, patient_id, $2, $3, $4, $5, $6, $7
      FROM immunizations WHERE id = $1
    `,
      [
        immunizationId,
        eventData.eventDate,
        eventData.severity,
        eventData.eventDescription,
        eventData.treatmentRequired || false,
        eventData.hospitalizationRequired || false,
        userId,
      ],
    );

    this.logger.log(`Adverse event recorded for immunization: ${immunizationId}`);
  }

  /**
   * Coverage report: doses by antigen (vaccine), optional period and age group.
   * For internal QA and DHIS2 alignment.
   */
  async getCoverageReport(
    tenantDb: DataSource,
    options: { periodStart?: string; periodEnd?: string; antigen?: string; ageGroup?: string },
  ): Promise<{
    period: { start: string | null; end: string | null };
    totalDoses: number;
    byAntigen: Array<{ vaccineCode: string; vaccineName: string; doses: number; uniquePatients: number }>;
    byAgeGroup?: Array<{ ageGroup: string; doses: number }>;
    generatedAt: string;
  }> {
    const params: any[] = [];
    let paramIndex = 1;
    const conditions: string[] = [];
    if (options.periodStart) {
      conditions.push(`i.administration_date >= $${paramIndex++}`);
      params.push(options.periodStart);
    }
    if (options.periodEnd) {
      conditions.push(`i.administration_date <= $${paramIndex++}`);
      params.push(options.periodEnd);
    }
    if (options.antigen) {
      conditions.push(`i.vaccine_code = $${paramIndex++}`);
      params.push(options.antigen);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totalRow, byAntigenRows] = await Promise.all([
      tenantDb.query(
        `SELECT COUNT(*)::int AS total FROM immunizations i ${whereClause}`,
        params,
      ),
      tenantDb.query(
        `SELECT i.vaccine_code AS "vaccineCode", i.vaccine_name AS "vaccineName",
                COUNT(*)::int AS doses,
                COUNT(DISTINCT i.patient_id)::int AS "uniquePatients"
         FROM immunizations i
         ${whereClause}
         GROUP BY i.vaccine_code, i.vaccine_name
         ORDER BY doses DESC`,
        params,
      ),
    ]);

    let byAgeGroup: Array<{ ageGroup: string; doses: number }> | undefined;
    if (options.ageGroup !== 'none') {
      const ageConditions = [...conditions];
      const ageParams = [...params];
      const ageWhere = ageConditions.length ? `WHERE ${ageConditions.join(' AND ')}` : '';
      const ageSelect = `
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM AGE(i.administration_date::timestamp, p.date_of_birth::timestamp)) < 1 THEN '0-11m'
            WHEN EXTRACT(YEAR FROM AGE(i.administration_date::timestamp, p.date_of_birth::timestamp)) < 5 THEN '1-4y'
            WHEN EXTRACT(YEAR FROM AGE(i.administration_date::timestamp, p.date_of_birth::timestamp)) < 15 THEN '5-14y'
            ELSE '15+'
          END AS "ageGroup",
          COUNT(*)::int AS doses
        FROM immunizations i
        JOIN patients p ON p.id = i.patient_id AND p.date_of_birth IS NOT NULL
        ${ageWhere}
        GROUP BY 1
        ORDER BY 1`;
      try {
        const ageRows = await tenantDb.query(ageSelect, ageParams);
        byAgeGroup = ageRows.map((r: any) => ({ ageGroup: r.ageGroup, doses: r.doses }));
      } catch {
        byAgeGroup = [];
      }
    }

    return {
      period: { start: options.periodStart ?? null, end: options.periodEnd ?? null },
      totalDoses: Number(totalRow[0]?.total ?? 0),
      byAntigen: (byAntigenRows || []).map((r: any) => ({
        vaccineCode: r.vaccineCode,
        vaccineName: r.vaccineName,
        doses: r.doses,
        uniquePatients: r.uniquePatients,
      })),
      byAgeGroup,
      generatedAt: new Date().toISOString(),
    };
  }
}

