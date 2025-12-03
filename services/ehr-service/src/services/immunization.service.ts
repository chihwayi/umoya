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
}

