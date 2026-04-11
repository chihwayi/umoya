import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { TmRemedy } from '../entities/tm-remedy.entity';
import { HdiAlert } from '../entities/hdi-alert.entity';
import { TmToxicityEvent } from '../entities/tm-toxicity-event.entity';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';

type InteractionResponse = {
  herbs_checked?: string[];
  drugs_checked?: string[];
  interactions_found?: number;
  has_major_interaction?: boolean;
  alert_level?: string;
  interactions?: Array<Record<string, any>>;
};

@Injectable()
export class TraditionalMedicineService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async recordRemedy(
    tenantId: string,
    patientId: string,
    recordedBy: string | null,
    dto: Partial<TmRemedy>,
  ): Promise<{ remedy: TmRemedy; interactionCheck: InteractionResponse }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(TmRemedy);
    const remedy = await repo.save(
      repo.create({
        ...dto,
        patientId,
        recordedBy: recordedBy ?? dto.recordedBy,
      } as Partial<TmRemedy>),
    ) as unknown as TmRemedy;

    const interactionCheck = await this.checkInteractions(tenantId, patientId, [remedy.remedyName], remedy.id);
    return { remedy, interactionCheck };
  }

  async getRemedies(tenantId: string, patientId: string): Promise<TmRemedy[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(TmRemedy).find({
      where: { patientId },
      order: { recordedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateRemedy(
    tenantId: string,
    id: string,
    dto: Partial<TmRemedy>,
  ): Promise<TmRemedy> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(TmRemedy);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Traditional medicine remedy not found');
    }
    await repo.update(id, dto as object);
    return (await repo.findOne({ where: { id } })) as TmRemedy;
  }

  async checkInteractions(
    tenantId: string,
    patientId: string,
    herbs: string[],
    tmRemedyId: string | null = null,
    activeDrugs?: string[],
  ): Promise<InteractionResponse> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const alertRepo = db.getRepository(HdiAlert);
    const drugs = activeDrugs && activeDrugs.length > 0
      ? activeDrugs.filter(Boolean)
      : await this.getActiveDrugNames(tenantId, patientId);
    const drugClasses = this.deriveDrugClasses(drugs);

    const response = await this.cdssService.tmHdiCheck(
      {
        herb_names: herbs,
        current_drugs: drugs,
        drug_classes: drugClasses,
      },
      tenantId,
    ) as InteractionResponse;

    for (const interaction of response.interactions || []) {
      const matchedDrugs: string[] = Array.isArray(interaction.matched_drugs) && interaction.matched_drugs.length > 0
        ? interaction.matched_drugs
        : drugs;
      for (const drugName of matchedDrugs) {
        const existing = await alertRepo.findOne({
          where: {
            patientId,
            tmRemedyId,
            drugName,
            mechanism: interaction.mechanism ?? null,
            severity: interaction.severity,
            acknowledgedAt: null,
          },
          order: { createdAt: 'DESC' },
        });
        if (existing) {
          continue;
        }
        const alert = alertRepo.create({
          patientId,
          tmRemedyId,
          drugName,
          drugRxcui: null,
          interactionType: interaction.interaction_type ?? 'unknown',
          mechanism: interaction.mechanism ?? null,
          severity: interaction.severity ?? 'informational',
          clinicalEffect: interaction.clinical_effect ?? 'Potential herb-drug interaction detected.',
          management: interaction.management ?? null,
          evidenceLevel: interaction.evidence_level ?? null,
        } as Partial<HdiAlert>);
        await alertRepo.save(alert);
      }
    }

    return response;
  }

  async getAlerts(tenantId: string, patientId: string): Promise<HdiAlert[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(HdiAlert)
      .createQueryBuilder('alert')
      .where('alert.patient_id = :patientId', { patientId })
      .orderBy('CASE WHEN alert.acknowledged_at IS NULL THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy(
        `CASE alert.severity
          WHEN 'contraindicated' THEN 0
          WHEN 'major' THEN 1
          WHEN 'moderate' THEN 2
          WHEN 'minor' THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('alert.triggered_at', 'DESC')
      .getMany();
  }

  async acknowledgeAlert(
    tenantId: string,
    alertId: string,
    userId: string | null,
    overrideReason?: string | null,
  ): Promise<HdiAlert> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(HdiAlert);
    const existing = await repo.findOne({ where: { id: alertId } });
    if (!existing) {
      throw new NotFoundException('HDI alert not found');
    }
    await repo.update(alertId, {
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      overrideReason: overrideReason ?? null,
    } as Partial<HdiAlert>);
    return (await repo.findOne({ where: { id: alertId } })) as HdiAlert;
  }

  async recordToxicityEvent(
    tenantId: string,
    patientId: string,
    recordedBy: string | null,
    dto: Partial<TmToxicityEvent>,
  ): Promise<{ event: TmToxicityEvent; toxicityGuidance: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(TmToxicityEvent);
    const event = await repo.save(
      repo.create({
        ...dto,
        patientId,
        recordedBy: recordedBy ?? dto.recordedBy,
      } as Partial<TmToxicityEvent>),
    ) as unknown as TmToxicityEvent;

    const herbNames = await this.getHerbNamesForToxicityContext(tenantId, patientId, dto.tmRemedyId ?? null);
    const toxicityGuidance = await this.cdssService.tmToxicityRisk(
      {
        herb_names: herbNames,
        organ_concerns: dto.organSystem ? [dto.organSystem] : [],
      },
      tenantId,
    );

    return { event, toxicityGuidance };
  }

  async getToxicityEvents(tenantId: string, patientId: string): Promise<TmToxicityEvent[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(TmToxicityEvent).find({
      where: { patientId },
      order: { recordedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  private async getActiveDrugNames(tenantId: string, patientId: string): Promise<string[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const prescriptions = await db.getRepository(Prescription).find({
      where: { patientId, status: PrescriptionStatus.ACTIVE },
      order: { prescribedDate: 'DESC' },
      take: 50,
    });
    return prescriptions
      .map((item) => item.medicationName)
      .filter((item): item is string => Boolean(item && item.trim()));
  }

  private async getHerbNamesForToxicityContext(
    tenantId: string,
    patientId: string,
    tmRemedyId: string | null,
  ): Promise<string[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(TmRemedy);
    if (tmRemedyId) {
      const remedy = await repo.findOne({ where: { id: tmRemedyId } });
      if (remedy?.remedyName) {
        return [remedy.remedyName];
      }
    }
    const remedies = await repo.find({
      where: { patientId, isOngoing: true },
      order: { recordedAt: 'DESC' },
      take: 20,
    });
    return remedies.map((item) => item.remedyName).filter(Boolean);
  }

  private deriveDrugClasses(drugNames: string[]): string[] {
    const classes = new Set<string>();
    for (const drugName of drugNames) {
      const name = drugName.toLowerCase();
      if (/(warfarin|apixaban|rivaroxaban|dabigatran|heparin|enoxaparin)/.test(name)) classes.add('anticoagulants');
      if (/(aspirin|clopidogrel|prasugrel|ticagrelor)/.test(name)) classes.add('antiplatelet_agents');
      if (/(efavirenz|nevirapine|ritonavir|lopinavir|atazanavir|dolutegravir|tenofovir|lamivudine)/.test(name)) classes.add('antiretrovirals');
      if (/(ethinyl|levonorgestrel|norgestrel|norethisterone|oral contraceptive|coc|pop)/.test(name)) classes.add('oral_contraceptives');
      if (/(sertraline|fluoxetine|paroxetine|citalopram|escitalopram|fluvoxamine)/.test(name)) classes.add('antidepressants_ssri');
      if (/(cyclosporine|tacrolimus|sirolimus)/.test(name)) classes.add('immunosuppressants');
      if (/(diazepam|lorazepam|alprazolam|midazolam|clonazepam)/.test(name)) classes.add('benzodiazepines');
      if (/(haloperidol|olanzapine|quetiapine|risperidone|chlorpromazine)/.test(name)) classes.add('antipsychotics');
      if (/(propofol|ketamine|thiopentone|isoflurane|sevoflurane)/.test(name)) classes.add('anaesthetics');
      if (/(alcohol|ethanol)/.test(name)) classes.add('alcohol');
      if (/(phenobarbital|pentobarbital)/.test(name)) classes.add('barbiturates');
      if (/(valproate|phenytoin|carbamazepine|levetiracetam|lamotrigine)/.test(name)) classes.add('antiepileptics');
      if (/(methotrexate|isoniazid|rifampicin|rifampin|paracetamol|acetaminophen)/.test(name)) classes.add('hepatotoxic_drugs');
      if (/(metformin|glibenclamide|gliclazide|insulin|pioglitazone|empagliflozin)/.test(name)) classes.add('antidiabetics');
      if (/(caffeine|amphetamine|methylphenidate)/.test(name)) classes.add('stimulants');
      if (/(amlodipine|losartan|enalapril|lisinopril|atenolol|hydrochlorothiazide)/.test(name)) classes.add('antihypertensives');
      if (/(prednisolone|prednisone|dexamethasone|hydrocortisone)/.test(name)) classes.add('corticosteroids');
      if (/(digoxin)/.test(name)) classes.add('digoxin');
      if (/(amiodarone|sotalol|flecainide)/.test(name)) classes.add('antiarrhythmics');
    }
    return Array.from(classes);
  }
}
