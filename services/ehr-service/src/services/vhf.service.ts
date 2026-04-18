import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { Patient } from '../entities/patient.entity';
import { VhfCase } from '../entities/vhf-case.entity';
import { VhfContact } from '../entities/vhf-contact.entity';
import { MpoxLesionAssessment } from '../entities/mpox-lesion-assessment.entity';

@Injectable()
export class VhfService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async reportCase(
    tenantId: string,
    reportedBy: string,
    dto: Partial<VhfCase> & Record<string, any>,
  ): Promise<{ caseRecord: VhfCase; cdssTriage: Record<string, any> | null }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const caseRepo = db.getRepository(VhfCase);
    const patientRepo = db.getRepository(Patient);

    const patient = dto.patientId
      ? await patientRepo.findOne({ where: { id: dto.patientId } })
      : null;

    const {
      fever,
      rash,
      haemorrhage,
      vomiting,
      diarrhoea,
      myalgia,
      headache,
      pharyngitis,
      travelEndemicArea,
      animalContact,
      contactWithVhfCase,
      healthcareWorker,
      immunocompromised,
      pregnant,
      ageYears,
      ...persisted
    } = dto;

    const entity = caseRepo.create({
      ...persisted,
      reportedBy,
      dateReported: dto.dateReported ?? new Date().toISOString().slice(0, 10),
      travelHistory: this.toJsonArray(dto.travelHistory),
      animalExposure: this.toJsonArray(dto.animalExposure),
      classification: dto.classification ?? 'suspected',
      isolationStatus: dto.isolationStatus ?? 'pending',
    } as Partial<VhfCase>);
    const saved = await caseRepo.save(entity) as unknown as VhfCase;

    let cdssTriage: Record<string, any> | null = null;
    try {
      cdssTriage = await this.cdssService.vhfRiskTriage(
        this.buildTriagePayload(saved, patient, {
          fever,
          rash,
          haemorrhage,
          vomiting,
          diarrhoea,
          myalgia,
          headache,
          pharyngitis,
          travelEndemicArea,
          animalContact,
          contactWithVhfCase,
          healthcareWorker,
          immunocompromised,
          pregnant,
          ageYears,
        }),
        tenantId,
      );

      const nextClassification = this.normalizeClassification(
        saved.classification,
        cdssTriage?.classification,
      );
      if (nextClassification !== saved.classification) {
        await caseRepo.update(saved.id, { classification: nextClassification });
        saved.classification = nextClassification;
      }
    } catch {
      cdssTriage = null;
    }

    return { caseRecord: saved, cdssTriage };
  }

  async getCases(
    tenantId: string,
    filters?: { pathogen?: string; classification?: string },
  ): Promise<VhfCase[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(VhfCase).createQueryBuilder('c')
      .leftJoinAndSelect('c.contacts', 'contacts')
      .orderBy('c.dateReported', 'DESC')
      .addOrderBy('c.createdAt', 'DESC');

    if (filters?.pathogen) {
      qb.andWhere('c.pathogen = :pathogen', { pathogen: filters.pathogen });
    }
    if (filters?.classification) {
      qb.andWhere('c.classification = :classification', { classification: filters.classification });
    }
    return qb.getMany();
  }

  async getCase(tenantId: string, id: string): Promise<VhfCase> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const row = await db.getRepository(VhfCase).findOne({
      where: { id },
      relations: ['contacts', 'lesionAssessments'],
    });
    if (!row) {
      throw new NotFoundException('VHF case not found');
    }
    return row;
  }

  async updateCase(tenantId: string, id: string, dto: Partial<VhfCase>): Promise<VhfCase> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(VhfCase);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('VHF case not found');
    }
    const patch: Partial<VhfCase> = {
      ...dto,
      travelHistory: dto.travelHistory ? this.toJsonArray(dto.travelHistory as any) : existing.travelHistory,
      animalExposure: dto.animalExposure ? this.toJsonArray(dto.animalExposure as any) : existing.animalExposure,
    };
    if (dto.outcome === 'died' && dto.caseFatality === undefined) {
      patch.caseFatality = true;
    }
    await repo.update(id, patch as object);
    return this.getCase(tenantId, id);
  }

  async addContact(tenantId: string, caseId: string, dto: Partial<VhfContact>): Promise<VhfContact> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const caseRepo = db.getRepository(VhfCase);
    const contactRepo = db.getRepository(VhfContact);
    const vhfCase = await caseRepo.findOne({ where: { id: caseId } });
    if (!vhfCase) {
      throw new NotFoundException('VHF case not found');
    }

    const monitoringStartDate = dto.monitoringStartDate ?? new Date().toISOString().slice(0, 10);
    const monitoringEndDate = dto.monitoringEndDate
      ?? this.addDays(dto.lastExposureDate ?? monitoringStartDate, 21);

    const entity = contactRepo.create({
      ...dto,
      caseId,
      monitoringStartDate,
      monitoringEndDate,
      dailySymptoms: Array.isArray(dto.dailySymptoms) ? dto.dailySymptoms : [],
      status: dto.status ?? 'under_monitoring',
    } as Partial<VhfContact>);
    const saved = await contactRepo.save(entity) as unknown as VhfContact;
    await this.refreshContactCounters(db, caseId);
    return saved;
  }

  async getContacts(tenantId: string, caseId: string): Promise<VhfContact[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(VhfContact).find({
      where: { caseId },
      order: { monitoringEndDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async updateContactStatus(
    tenantId: string,
    contactId: string,
    status: string,
    becameCaseId?: string,
  ): Promise<VhfContact> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(VhfContact);
    const existing = await repo.findOne({ where: { id: contactId } });
    if (!existing) {
      throw new NotFoundException('VHF contact not found');
    }
    await repo.update(contactId, {
      status,
      becameCaseId: becameCaseId ?? existing.becameCaseId,
    });
    await this.refreshContactCounters(db, existing.caseId);
    return (await repo.findOne({ where: { id: contactId } })) as VhfContact;
  }

  async recordLesionAssessment(
    tenantId: string,
    assessedBy: string,
    dto: Partial<MpoxLesionAssessment> & Record<string, any>,
  ): Promise<{ assessment: MpoxLesionAssessment; cdssSeverity: Record<string, any> | null }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const lesionRepo = db.getRepository(MpoxLesionAssessment);
    const patientRepo = db.getRepository(Patient);

    const patient = dto.patientId
      ? await patientRepo.findOne({ where: { id: dto.patientId } })
      : null;

    const {
      immunocompromised,
      hivPositive,
      pregnant,
      clade,
      ageYears,
      mucocutaneousSites,
      ...persisted
    } = dto;

    const entity = lesionRepo.create({
      ...persisted,
      assessedBy,
      assessmentDate: dto.assessmentDate ?? new Date().toISOString().slice(0, 10),
      lesionDistribution: this.toJsonObject(dto.lesionDistribution),
      cnsSymptoms: Array.isArray(dto.cnsSymptoms) ? dto.cnsSymptoms : [],
      supportiveCare: Array.isArray(dto.supportiveCare) ? dto.supportiveCare : [],
    } as Partial<MpoxLesionAssessment>);
    const saved = await lesionRepo.save(entity) as unknown as MpoxLesionAssessment;

    let cdssSeverity: Record<string, any> | null = null;
    try {
      cdssSeverity = await this.cdssService.mpoxSeverity(
        {
          stage: saved.stage,
          day_of_illness: saved.dayOfIllness ?? 0,
          lesion_count_category: saved.lesionCountCategory ?? 'few_<10',
          mucocutaneous_sites: Array.isArray(mucocutaneousSites) && mucocutaneousSites.length > 0
            ? mucocutaneousSites
            : this.extractMucocutaneousSites(saved),
          corneal_involvement: saved.cornealInvolvement,
          respiratory_involvement: saved.respiratoryInvolvement,
          secondary_infection: saved.secondaryBacterialInfection,
          cns_involvement: saved.cnsInvolvement,
          immunocompromised: this.booleanOrNull(immunocompromised),
          hiv_positive: this.booleanOrNull(hivPositive),
          age_years: this.numberOrNull(ageYears) ?? patient?.age ?? null,
          pregnant: this.booleanOrNull(pregnant) ?? this.derivePregnant(patient),
          clade: clade ?? null,
        },
        tenantId,
      );

      const patch: Partial<MpoxLesionAssessment> = {
        cdssSeverityScore: this.numberOrNull(cdssSeverity?.severity_score),
        cdssRecommendation: Array.isArray(cdssSeverity?.care_principles)
          ? cdssSeverity.care_principles.join('; ')
          : null,
        cdssConfidence: this.numberOrNull(cdssSeverity?.confidence),
      };
      if (saved.antiviralIndicated !== true && cdssSeverity?.antiviral_indicated === true) {
        patch.antiviralIndicated = true;
        patch.antiviralDrug = cdssSeverity?.antiviral_drug ?? null;
        patch.antiviralDose = cdssSeverity?.antiviral_dose ?? null;
      }
      await lesionRepo.update(saved.id, patch as object);
      Object.assign(saved, patch);
    } catch {
      cdssSeverity = null;
    }

    return { assessment: saved, cdssSeverity };
  }

  async getLesionHistory(tenantId: string, patientId: string): Promise<MpoxLesionAssessment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MpoxLesionAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async triageCase(
    tenantId: string,
    caseId: string,
    triageDto: Record<string, any>,
  ): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const caseRepo = db.getRepository(VhfCase);
    const patientRepo = db.getRepository(Patient);
    const row = await caseRepo.findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException('VHF case not found');
    }
    const patient = await patientRepo.findOne({ where: { id: row.patientId } });
    return this.cdssService.vhfRiskTriage(this.buildTriagePayload(row, patient, triageDto), tenantId);
  }

  async getActiveSurveillanceSummary(tenantId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const caseRepo = db.getRepository(VhfCase);
    const contactRepo = db.getRepository(VhfContact);

    const [
      total,
      suspected,
      probable,
      confirmed,
      contactsUnderMonitoring,
      mpoxCases,
      whoNotificationsPending,
    ] = await Promise.all([
      caseRepo.count(),
      caseRepo.count({ where: { classification: 'suspected' } }),
      caseRepo.count({ where: { classification: 'probable' } }),
      caseRepo.count({ where: { classification: 'confirmed' } }),
      contactRepo.count({ where: { status: 'under_monitoring' } }),
      caseRepo.count({ where: [{ pathogen: 'mpox_clade_i' }, { pathogen: 'mpox_clade_ii' }] }),
      caseRepo.createQueryBuilder('c')
        .where("c.classification IN ('probable', 'confirmed')")
        .andWhere('c.notifiedWho = false')
        .getCount(),
    ]);

    return {
      total,
      suspected,
      probable,
      confirmed,
      mpoxCases,
      contactsUnderMonitoring,
      whoNotificationsPending,
    };
  }

  private async refreshContactCounters(db: any, caseId: string): Promise<void> {
    const contactRepo = db.getRepository(VhfContact);
    const caseRepo = db.getRepository(VhfCase);
    const [contactsListed, contactsUnderFollowup] = await Promise.all([
      contactRepo.count({ where: { caseId } }),
      contactRepo.count({ where: { caseId, status: 'under_monitoring' } }),
    ]);
    await caseRepo.update(caseId, {
      contactsListed,
      contactsUnderFollowup,
    });
  }

  private buildTriagePayload(
    row: VhfCase,
    patient: Patient | null,
    overrides: Record<string, any>,
  ): Record<string, any> {
    return {
      pathogen: row.pathogen,
      symptom_onset_days: row.symptomOnsetDate ? this.daysSince(row.symptomOnsetDate) : null,
      fever: this.booleanOrNull(overrides?.fever),
      rash: this.booleanOrNull(overrides?.rash),
      haemorrhage: this.booleanOrNull(overrides?.haemorrhage),
      vomiting: this.booleanOrNull(overrides?.vomiting),
      diarrhoea: this.booleanOrNull(overrides?.diarrhoea),
      myalgia: this.booleanOrNull(overrides?.myalgia),
      headache: this.booleanOrNull(overrides?.headache),
      pharyngitis: this.booleanOrNull(overrides?.pharyngitis),
      travel_endemic_area: this.booleanOrNull(overrides?.travelEndemicArea)
        ?? (Array.isArray(row.travelHistory) && row.travelHistory.length > 0),
      animal_contact: this.booleanOrNull(overrides?.animalContact)
        ?? (Array.isArray(row.animalExposure) && row.animalExposure.length > 0),
      contact_with_vhf_case: this.booleanOrNull(overrides?.contactWithVhfCase),
      healthcare_worker: this.booleanOrNull(overrides?.healthcareWorker)
        ?? row.exposureType === 'healthcare_worker',
      lab_pcr_result: row.labPcrResult ?? null,
      age_years: this.numberOrNull(overrides?.ageYears) ?? patient?.age ?? null,
      immunocompromised: this.booleanOrNull(overrides?.immunocompromised),
      pregnant: this.booleanOrNull(overrides?.pregnant) ?? this.derivePregnant(patient),
    };
  }

  private extractMucocutaneousSites(assessment: MpoxLesionAssessment): string[] {
    const distribution = this.toJsonObject(assessment.lesionDistribution);
    const sites: string[] = [];
    if (distribution.oral_mucosa || distribution.oral) sites.push('oral');
    if (distribution.genitalia || assessment.genitalLesions) sites.push('genital');
    if (distribution.anal || assessment.proctitis) sites.push('anal');
    if (distribution.conjunctival || distribution.eyes || assessment.cornealInvolvement) sites.push('conjunctival');
    return sites;
  }

  private normalizeClassification(currentValue: string, nextValue: string | null | undefined): string {
    if (!nextValue) {
      return currentValue;
    }
    if (nextValue === 'low_risk') {
      return currentValue === 'suspected' ? 'discarded' : currentValue;
    }
    return nextValue;
  }

  private derivePregnant(patient: Patient | null): boolean | null {
    if (!patient?.pregnancyStatus) {
      return null;
    }
    return patient.pregnancyStatus === 'pregnant';
  }

  private daysSince(value: string): number | null {
    const input = new Date(value);
    if (Number.isNaN(input.getTime())) {
      return null;
    }
    return Math.max(0, Math.floor((Date.now() - input.getTime()) / 86400000));
  }

  private addDays(value: string, days: number): string {
    const input = new Date(value);
    input.setDate(input.getDate() + days);
    return input.toISOString().slice(0, 10);
  }

  private toJsonArray(value: any): Record<string, any>[] {
    return Array.isArray(value) ? value : [];
  }

  private toJsonObject(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  private booleanOrNull(value: any): boolean | null {
    if (value === true) return true;
    if (value === false) return false;
    return null;
  }

  private numberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
