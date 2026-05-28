import { Injectable, Logger } from '@nestjs/common';
import { Repository, DataSource, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TbaRegister } from './entities/tba-register.entity';
import { HomeBirthRecord } from './entities/home-birth-record.entity';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { CrvsService } from '../services/crvs.service'; // Assuming CRVS service exists and handles notifications

@Injectable()
export class TbaService {
  private readonly logger = new Logger(TbaService.name);

  constructor(
    private tenantService: TenantService,
    private cdssService: CdssService,
    private crvsService: CrvsService, // Inject CRVS service
  ) {}

  private async getRepository<T>(tenantId: string, entity: any): Promise<Repository<T>> {
    const dataSource = await this.tenantService.getTenantDatabase(tenantId);
    if (!dataSource) throw new Error(`Could not connect to tenant database for ${tenantId}`);
    return dataSource.getRepository(entity);
  }

  async notifyBirth(birthData: {
    motherNationalId?: string;
    babyFirstName: string;
    babyLastName: string;
    dateOfBirth: string;
    facilityCode?: string;
    attendantType?: string;
    birthWeight?: number;
    gestationalAge?: number;
    tenantCountryCode?: string;
  }): Promise<{ submitted: boolean; referenceNumber?: string; skipped?: boolean }> {
    const crvsEnabled = process.env.CRVS_ENABLED === 'true';
    const crvsEndpoint = process.env.CRVS_ENDPOINT;
    const crvsApiKey = process.env.CRVS_API_KEY;

    if (!crvsEnabled || !crvsEndpoint) {
      this.logger.log('CRVS birth notification skipped - not configured');
      return { submitted: false, skipped: true };
    }

    const payload = {
      eventType: 'BIRTH',
      eventDate: birthData.dateOfBirth,
      child: {
        firstName: birthData.babyFirstName,
        lastName: birthData.babyLastName,
        dateOfBirth: birthData.dateOfBirth,
        birthWeight: birthData.birthWeight,
        gestationalAge: birthData.gestationalAge,
      },
      mother: {
        nationalId: birthData.motherNationalId,
      },
      facility: {
        code: birthData.facilityCode,
        attendantType: birthData.attendantType ?? 'SKILLED_BIRTH_ATTENDANT',
      },
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(crvsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': crvsApiKey ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`CRVS birth notification failed: ${response.status} ${text}`);
        return { submitted: false };
      }

      const result = await response.json().catch(() => ({}));
      this.logger.log(`CRVS birth submitted: ${result.referenceNumber ?? 'no-ref'}`);
      return { submitted: true, referenceNumber: result.referenceNumber };
    } catch (err: any) {
      this.logger.error(`CRVS birth notification error: ${err.message}`);
      return { submitted: false };
    }
  }

  async notifyDeath(deathData: {
    deceasedNationalId?: string;
    deceasedFirstName: string;
    deceasedLastName: string;
    dateOfDeath: string;
    causeOfDeath?: string;
    icd10Code?: string;
    facilityCode?: string;
    tenantCountryCode?: string;
  }): Promise<{ submitted: boolean; referenceNumber?: string; skipped?: boolean }> {
    const crvsEnabled = process.env.CRVS_ENABLED === 'true';
    const crvsEndpoint = process.env.CRVS_ENDPOINT;
    const crvsApiKey = process.env.CRVS_API_KEY;

    if (!crvsEnabled || !crvsEndpoint) {
      this.logger.log('CRVS death notification skipped - not configured');
      return { submitted: false, skipped: true };
    }

    const payload = {
      eventType: 'DEATH',
      eventDate: deathData.dateOfDeath,
      deceased: {
        firstName: deathData.deceasedFirstName,
        lastName: deathData.deceasedLastName,
        nationalId: deathData.deceasedNationalId,
        dateOfDeath: deathData.dateOfDeath,
      },
      causeOfDeath: {
        description: deathData.causeOfDeath,
        icd10Code: deathData.icd10Code,
      },
      facility: {
        code: deathData.facilityCode,
      },
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(crvsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': crvsApiKey ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`CRVS death notification failed: ${response.status} ${text}`);
        return { submitted: false };
      }

      const result = await response.json().catch(() => ({}));
      this.logger.log(`CRVS death submitted: ${result.referenceNumber ?? 'no-ref'}`);
      return { submitted: true, referenceNumber: result.referenceNumber };
    } catch (err: any) {
      this.logger.error(`CRVS death notification error: ${err.message}`);
      return { submitted: false };
    }
  }

  // ── TBA Register ───────────────────────────────────────────────────────────

  async registerTba(tenantId: string, data: Partial<TbaRegister>): Promise<TbaRegister> {
    const repo = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    const tba = repo.create(data);

    // Auto-score risk using CDSS upon registration
    if (tba.totalDeliveries && tba.maternalDeaths && tba.neonatalDeaths && tba.referralsMade !== undefined) {
      try {
        const tbaRisk = await this.cdssService.tbaSupervisionRisk({
          tba_code: tba.tbaCode,
          total_deliveries: tba.totalDeliveries,
          maternal_deaths: tba.maternalDeaths,
          neonatal_deaths: tba.neonatalDeaths,
          referrals_made: tba.referralsMade,
          trained: tba.trained,
          training_type: tba.trainingType,
          last_supervision_months_ago: 12, // Placeholder - needs actual supervision date logic
          misoprostol_use_rate: 0.5, // Placeholder - needs actual data aggregation
          cord_safe_practice_rate: 0.7, // Placeholder - needs actual data aggregation
        }, tenantId);

        tba.supervisionScore = tbaRisk.supervision_score;
        tba.supervisionRisk = tbaRisk.supervision_risk;
        // Store risk factors, recommended training etc. if needed (e.g., in a separate log table or extension)

      } catch (error) {
        this.logger.warn(`CDSS TBA supervision risk scoring unavailable: ${error.message}`);
        tba.supervisionRisk = 'unknown'; // Default to unknown if CDSS fails
      }
    }

    // Ensure repo is awaited before calling save
    const repository = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    return await repository.save(tba);
  }

  async getTbas(tenantId: string, district?: string): Promise<TbaRegister[]> {
    const repository = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    const whereClause: any = { registrationStatus: 'active' };
    if (district) {
      whereClause.district = district;
    }
    // Await the find method explicitly
    return await repository.find({ where: whereClause, order: { district: 'ASC', fullName: 'ASC' } });
  }

  async getTbaById(tenantId: string, id: string): Promise<TbaRegister | null> {
    const repository = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    // Await the findOne method explicitly
    return await repository.findOne({ where: { id } });
  }

  async updateTba(tenantId: string, id: string, data: Partial<TbaRegister>): Promise<TbaRegister | null> {
    const repository = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    // Await the update method
    await repository.update(id, data);
    // Await the findOne method
    return await repository.findOne({ where: { id } });
  }

  async scoreTbaRisk(tenantId: string, id: string): Promise<TbaRegister | null> {
    // getTbaById already handles awaiting repository
    const tba = await this.getTbaById(tenantId, id);
    if (!tba) return null;

    try {
      const tbaRisk = await this.cdssService.tbaSupervisionRisk({
        tba_code: tba.tbaCode,
        total_deliveries: tba.totalDeliveries,
        maternal_deaths: tba.maternalDeaths,
        neonatal_deaths: tba.neonatalDeaths,
        referrals_made: tba.referralsMade,
        trained: tba.trained,
        training_type: tba.trainingType,
        last_supervision_months_ago: 12, // Placeholder: Needs calculation based on lastSupervisionDate
        misoprostol_use_rate: 0.5, // Placeholder: Needs actual data aggregation
        cord_safe_practice_rate: 0.7, // Placeholder: Needs actual data aggregation
      }, tenantId);

      // Update TBA record with CDSS scores
      // updateTba already handles awaiting repository
      return this.updateTba(tenantId, id, {
        supervisionScore: tbaRisk.supervision_score,
        supervisionRisk: tbaRisk.supervision_risk,
        // Recommended training can be stored if required by business logic
      });

    } catch (error) {
      this.logger.warn(`CDSS TBA supervision risk scoring failed for TBA ${id}: ${error.message}`);
      // Update risk to unknown on failure
      // updateTba already handles awaiting repository
      return this.updateTba(tenantId, id, { supervisionRisk: 'unknown' });
    }
  }

  // ── Home Birth Records ──────────────────────────────────────────────────────

  async recordHomeBirth(tenantId: string, data: Partial<HomeBirthRecord>): Promise<HomeBirthRecord> {
    const repository = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);
    const birthRecord = repository.create(data);

    const savedRecord = await repository.save(birthRecord);

    if (savedRecord.birthOutcome === 'live_birth' && !savedRecord.crvsNotified) {
      try {
        await this.crvsService.notifyHomeBirth(tenantId, {
          motherName: savedRecord.motherName,
          birthDate: savedRecord.birthDate,
          babySex: savedRecord.babySex,
          babyAlive: savedRecord.babyAlive,
          motherAlive: savedRecord.maternalAlive,
          village: savedRecord.motherVillage,
          tbaId: savedRecord.tbaId,
          attendedByType: savedRecord.attendedByType,
        });
        await repository.update(savedRecord.id, {
          crvsNotified: true,
          crvsNotificationDate: new Date().toISOString().split('T')[0],
        });
        this.logger.log(`CRVS notified for home birth ${savedRecord.id}`);
      } catch (error: any) {
        this.logger.error(`CRVS notification failed for home birth ${savedRecord.id}: ${error?.message}`);
      }
    }

    // CDSS risk assessment after saving (as it might use referral status)
    if (savedRecord.attendedByType === 'tba' && savedRecord.tbaId) {
      try {
        const tbaRepo = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
        const tba = await tbaRepo.findOne({ where: { id: savedRecord.tbaId } }); // Await findOne
        const homeBirthRisk = await this.cdssService.homeBirthRisk({
          mother_age_years: savedRecord.motherAgeYears,
          parity: savedRecord.motherParity,
          antenatal_visits: savedRecord.antenatalVisits,
          gestational_age_weeks: savedRecord.gestationalAgeWeeks,
          previous_complications: savedRecord.maternalComplications,
          attended_by_trained_tba: tba?.trained ?? false, // Use TBA's trained status
          distance_to_facility_km: 10, // Placeholder - needs actual TBA/facility distance logic
          maternal_complications: savedRecord.maternalComplications,
        }, tenantId);

        await repository.update(savedRecord.id, {
          cdssRiskLevel: homeBirthRisk.maternal_risk, // Using maternal risk for overall birth risk
          cdssRecommendation: homeBirthRisk.immediate_actions.join('; '),
          cdssConfidence: homeBirthRisk.confidence,
        });

        // If immediate referral is required, update the birth record
        if (homeBirthRisk.immediate_referral_required) {
          await repository.update(savedRecord.id, {
            referred: true,
            referralReason: homeBirthRisk.referral_reason,
            // referralFacility can be determined by TBA's assigned facility if available
          });
        }

      } catch (error) {
        this.logger.warn(`CDSS home birth risk assessment unavailable for birth ID ${savedRecord.id}: ${error.message}`);
        await repository.update(savedRecord.id, { cdssRiskLevel: 'unknown' });
      }
    }

    return savedRecord;
  }

  async getHomeBirths(tenantId: string, filters?: any): Promise<{ tba_summary: any; birth_summary: any; birth_records: HomeBirthRecord[] }> {
    const repo = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);
    const whereClause: any = {};
    if (filters?.patientId) whereClause.motherPatientId = filters.patientId;
    if (filters?.tbaId) whereClause.tbaId = filters.tbaId;
    // Removed direct filtering on tba.district from whereClause as it's handled by queryBuilder join
    if (filters?.startDate) whereClause.birthDate = MoreThanOrEqual(filters.startDate);
    if (filters?.endDate) whereClause.birthDate = LessThanOrEqual(filters.endDate);

    const queryBuilder = repo.createQueryBuilder('birth')
      .select([
        'COUNT(birth.id) as total_home_births',
        'SUM(CASE WHEN birth.birth_outcome = :liveBirth THEN 1 ELSE 0 END) as live_births',
        'SUM(CASE WHEN birth.birth_outcome IN (:...stillbirths) THEN 1 ELSE 0 END) as stillbirths',
        'SUM(CASE WHEN birth.maternal_alive = false THEN 1 ELSE 0 END) as maternal_deaths_home_births',
        'SUM(CASE WHEN birth.baby_alive = false THEN 1 ELSE 0 END) as neonatal_deaths_home_births',
        'SUM(CASE WHEN birth.crvs_notified = :crvsNotified AND birth.birth_outcome = :liveBirth THEN 1 ELSE 0 END) as unregistered_live_births',
        'SUM(CASE WHEN birth.referred = true THEN 1 ELSE 0 END) as referred_births',
      ])
      .leftJoin('tba_register', 'tba', 'birth.tba_id = tba.id'); // Initial join for potential filtering
    
    // Set parameters for the SELECT clause
    queryBuilder.setParameter('liveBirth', 'live_birth');
    queryBuilder.setParameter('stillbirths', ['fresh_stillbirth', 'macerated_stillbirth']);
    queryBuilder.setParameter('crvsNotified', false); // Assuming we are counting not-yet-notified

    // Apply district filter if provided, ensuring correct join
    if (filters?.district) {
      queryBuilder.innerJoin('tba_register', 'tba_filtered', 'birth.tba_id = tba_filtered.id');
      queryBuilder.andWhere('tba_filtered.district = :district', { district: filters.district });
    }

    // Apply date filters
    if (filters?.startDate) {
      queryBuilder.andWhere('birth.birthDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('birth.birthDate <= :endDate', { endDate: filters.endDate });
    }
    
    // Await the raw query execution
    const birthSummary = await queryBuilder.getRawOne();

    // Fetch actual birth records - ensure repo is awaited
    const birthRecords = await repo.find({ where: whereClause, order: { birthDate: 'DESC', birthTime: 'DESC' }, relations: ['tba'] });

    // Fetch TBA summary, incorporating district filter if provided
    const tbaSummary = await this.getTbaSummary(tenantId, filters?.district);

    return {
      tba_summary: tbaSummary, // Include TBA summary
      birth_summary: birthSummary,
      birth_records: birthRecords,
    };
  }

  async getHomeBirthById(tenantId: string, id: string): Promise<HomeBirthRecord | null> {
    const repository = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);
    // Await the findOne method explicitly
    return await repository.findOne({ where: { id }, relations: ['tba'] });
  }

  async updateHomeBirth(tenantId: string, id: string, data: Partial<HomeBirthRecord>): Promise<HomeBirthRecord | null> {
    const repository = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);
    // Await the update method
    await repository.update(id, data);
    // Await the findOne method
    return await repository.findOne({ where: { id }, relations: ['tba'] });
  }

  async notifyCRVS(tenantId: string, birthId: string): Promise<any> {
    const repository = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);
    const birthRecord = await repository.findOne({ where: { id: birthId }, relations: ['tba'] });

    if (!birthRecord) throw new Error('Home birth record not found');
    if (birthRecord.crvsNotified) return { message: 'Already notified', status: 'already_notified' };

    if (birthRecord.birthOutcome !== 'live_birth') {
      return { message: 'Only live births are eligible for CRVS notification', status: 'not_eligible' };
    }

    const certificateNumber = await this.crvsService.notifyHomeBirth(tenantId, {
      motherPatientId: birthRecord.motherPatientId,
      motherName: birthRecord.motherName,
      birthDate: birthRecord.birthDate,
      birthType: 'single',
      gestationalAgeWeeks: birthRecord.gestationalAgeWeeks,
      birthWeightGrams: birthRecord.birthWeightKg ? Math.round(Number(birthRecord.birthWeightKg) * 1000) : null,
      babySex: birthRecord.babySex,
      babyAlive: birthRecord.babyAlive,
      placeOfBirth: 'home',
      deliveryMode: 'home_delivery',
    });

    await repository.update(birthId, {
      crvsNotified: true,
      crvsNotificationDate: new Date().toISOString().split('T')[0],
      birthCertificateNumber: certificateNumber ?? undefined,
    });

    this.logger.log(`CRVS notification successful for home birth ID: ${birthId}`);
    return { message: 'CRVS notification successful', status: 'notified', certificateNumber };
  }

  async getTbaSummary(tenantId: string, district?: string, filters?: any): Promise<any> {
    const repo = await this.getRepository<TbaRegister>(tenantId, TbaRegister);
    const birthRepo = await this.getRepository<HomeBirthRecord>(tenantId, HomeBirthRecord);

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    const queryBuilder = repo.createQueryBuilder('tba')
      .select([
        'COUNT(tba.id) as total_tbas',
        'SUM(CASE WHEN tba.registration_status = :activeStatus THEN 1 ELSE 0 END) as active_tbas',
        'SUM(CASE WHEN tba.supervision_risk = :highRisk THEN 1 ELSE 0 END) as high_risk_tbas',
        'SUM(CASE WHEN tba.last_supervision_date < :cutoffDate THEN 1 ELSE 0 END) as overdue_supervision_tbas',
        'SUM(tba.total_deliveries) as total_deliveries_tbas',
        'SUM(tba.maternal_deaths) as maternal_deaths_tbas',
        'SUM(tba.neonatal_deaths) as neonatal_deaths_tbas',
        'SUM(tba.referrals_made) as total_referrals_tbas',
      ])
      .where('tba.registration_status = :activeStatus', { activeStatus: 'active' });

    if (district) {
      queryBuilder.andWhere('tba.district = :district', { district });
    }
    // Add date filters to tba summary if needed, or they apply to birth summary

    // Await the query execution
    const tbaSummary = await queryBuilder.getRawOne();

    const birthQueryBuilder = birthRepo.createQueryBuilder('birth')
      .select([
        'COUNT(birth.id) as total_home_births',
        'SUM(CASE WHEN birth.birth_outcome = :liveBirth THEN 1 ELSE 0 END) as live_births',
        'SUM(CASE WHEN birth.birth_outcome IN (:...stillbirths) THEN 1 ELSE 0 END) as stillbirths',
        'SUM(CASE WHEN birth.maternal_alive = false THEN 1 ELSE 0 END) as maternal_deaths_home_births',
        'SUM(CASE WHEN birth.baby_alive = false THEN 1 ELSE 0 END) as neonatal_deaths_home_births',
        'SUM(CASE WHEN birth.crvs_notified = :crvsNotified AND birth.birth_outcome = :liveBirth THEN 1 ELSE 0 END) as unregistered_live_births',
        'SUM(CASE WHEN birth.referred = true THEN 1 ELSE 0 END) as referred_births',
      ])
      .leftJoin('tba_register', 'tba', 'birth.tba_id = tba.id');
    
    // Set parameters for the SELECT clause
    birthQueryBuilder.setParameter('liveBirth', 'live_birth');
    birthQueryBuilder.setParameter('stillbirths', ['fresh_stillbirth', 'macerated_stillbirth']);
    birthQueryBuilder.setParameter('crvsNotified', false);
    
    // Apply district filter if provided
    if (district) {
      birthQueryBuilder.innerJoin('tba_register', 'tba', 'birth.tba_id = tba.id');
      birthQueryBuilder.andWhere('tba.district = :district', { district });
    }

    // Apply date filters
    if (filters?.startDate) {
      queryBuilder.andWhere('tba.last_supervision_date >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('tba.last_supervision_date <= :endDate', { endDate: filters.endDate });
    }
    
    // Await the raw query execution
    const birthSummary = await queryBuilder.getRawOne();

    return {
      tba_summary: tbaSummary,
      birth_summary: birthSummary,
    };
  }
}
