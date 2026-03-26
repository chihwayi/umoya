import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { SeizureRecord } from '../entities/seizure-record.entity';
import { StrokeAssessment } from '../entities/stroke-assessment.entity';
import { HeadacheDiary } from '../entities/headache-diary.entity';
import { NeurologyExamination } from '../entities/neurology-examination.entity';
import { CognitiveAssessment } from '../entities/cognitive-assessment.entity';

@Injectable()
export class NeurologyService {
  private readonly logger = new Logger(NeurologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Seizures ───────────────────────────────────────────────────────────────

  async addSeizure(tenantSubdomain: string, dto: Partial<SeizureRecord>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(SeizureRecord);
    return repo.save(repo.create(dto as any));
  }

  async getSeizures(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(SeizureRecord).find({
      where: { patientId },
      order: { seizureDate: 'DESC' },
    });
  }

  // ── Stroke ─────────────────────────────────────────────────────────────────

  async addStrokeAssessment(tenantSubdomain: string, dto: Partial<StrokeAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(StrokeAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getStrokeAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(StrokeAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateStrokeAssessment(tenantSubdomain: string, id: string, dto: Partial<StrokeAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(StrokeAssessment).update(id, dto as any);
    return ds.getRepository(StrokeAssessment).findOne({ where: { id } });
  }

  // ── Headache Diary ─────────────────────────────────────────────────────────

  async addHeadacheEntry(tenantSubdomain: string, dto: Partial<HeadacheDiary>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(HeadacheDiary);
    return repo.save(repo.create(dto as any));
  }

  async getHeadacheDiary(tenantSubdomain: string, patientId: string, limit = 30) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(HeadacheDiary).find({
      where: { patientId },
      order: { entryDate: 'DESC' },
      take: limit,
    });
  }

  // ── Neurology Exam ─────────────────────────────────────────────────────────

  async addExam(tenantSubdomain: string, dto: Partial<NeurologyExamination>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(NeurologyExamination);
    return repo.save(repo.create(dto as any));
  }

  async getExams(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(NeurologyExamination).find({
      where: { patientId },
      order: { examDate: 'DESC' },
    });
  }

  // ── Cognitive Assessments ──────────────────────────────────────────────────

  async addCognitiveAssessment(tenantSubdomain: string, dto: Partial<CognitiveAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(CognitiveAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getCognitiveAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(CognitiveAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async triageStroke(payload: Record<string, any>) {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          ...payload,
          context: 'stroke_triage',
          specialty: 'neurology',
          module: 'stroke_care',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[Neurology] CDSS stroke triage unavailable: ${err?.message}`);
      return this.localStrokeTriage(payload);
    }
  }

  async classifySeizure(payload: Record<string, any>) {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          ...payload,
          context: 'seizure_classification',
          specialty: 'neurology',
          module: 'epilepsy_care',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[Neurology] CDSS seizure classification unavailable: ${err?.message}`);
      return this.localSeizureClassify(payload);
    }
  }

  async diagnoseHeadache(payload: Record<string, any>) {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          ...payload,
          context: 'headache_diagnosis',
          specialty: 'neurology',
          module: 'headache_care',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[Neurology] CDSS headache diagnosis unavailable: ${err?.message}`);
      return this.localHeadacheDiagnosis(payload);
    }
  }

  /** FAST + Cincinnati Prehospital Stroke Scale + thrombolysis window. */
  private localStrokeTriage(payload: Record<string, any>): Record<string, any> {
    const fastScore = [payload.facial_droop, payload.arm_weakness, payload.speech_difficulty].filter(Boolean).length;
    const onsetMinutes = payload.onset_minutes != null
      ? Number(payload.onset_minutes)
      : payload.onset_hours != null
        ? Number(payload.onset_hours) * 60
        : NaN;
    const flags: string[] = [];
    if (payload.facial_droop)       flags.push('Facial droop');
    if (payload.arm_weakness)       flags.push('Arm weakness');
    if (payload.speech_difficulty)  flags.push('Speech difficulty');
    if (payload.vision_disturbance) flags.push('Visual disturbance');
    if (payload.sudden_headache)    flags.push('Sudden severe headache (thunderclap — suspect SAH)');

    const strokeLikely = fastScore >= 2;
    const withinIvtWindow = !isNaN(onsetMinutes) && onsetMinutes <= 270; // 4.5 h
    const withinThrombectomyWindow = !isNaN(onsetMinutes) && onsetMinutes <= 360;

    return {
      source: 'local_fallback',
      fast_score: fastScore,
      stroke_likely: strokeLikely,
      flags,
      within_ivt_window: withinIvtWindow,
      within_thrombectomy_window: withinThrombectomyWindow,
      recommendation: strokeLikely
        ? `STROKE ALERT: Activate stroke pathway. ${withinIvtWindow ? 'IVT (alteplase) may be indicated — immediate CT + neurology review.' : withinThrombectomyWindow ? 'IVT window closed — consider thrombectomy.' : 'Outside acute treatment window — admit for secondary prevention.'}`
        : 'Stroke unlikely but cannot exclude TIA — urgent neurology review within 24 h',
      guideline: 'ESO Stroke Guidelines 2021; AHA/ASA 2019',
    };
  }

  /** ILAE 2017 seizure classification. */
  private localSeizureClassify(payload: Record<string, any>): Record<string, any> {
    const awareness = payload.awareness_retained === true;
    const motor = payload.motor_onset === true;
    const generalised = payload.generalised === true || payload.bilateral_tonic_clonic;
    let seizureType = 'unknown';
    if (generalised)            seizureType = 'Generalised tonic-clonic';
    else if (motor && awareness)  seizureType = 'Focal aware motor';
    else if (motor && !awareness) seizureType = 'Focal impaired awareness motor';
    else if (!motor && awareness) seizureType = 'Focal aware non-motor';
    else if (!motor && !awareness)seizureType = 'Focal impaired awareness non-motor';

    const firstSeizure = payload.first_seizure === true;
    return {
      source: 'local_fallback',
      seizure_type: seizureType,
      first_seizure: firstSeizure,
      recommendation: firstSeizure
        ? 'First seizure: MRI brain (without and with contrast), EEG, metabolic panel. Antiepileptic drug initiation based on recurrence risk.'
        : 'Known epilepsy: review AED levels, compliance, precipitants. Adjust therapy if breakthrough seizures.',
      status_epilepticus: payload.duration_minutes > 5,
      guideline: 'ILAE Classification 2017; NICE NG217 2022',
    };
  }

  /** ICHD-3 headache red flag screening. */
  private localHeadacheDiagnosis(payload: Record<string, any>): Record<string, any> {
    const redFlags: string[] = [];
    if (payload.thunderclap)        redFlags.push('Thunderclap onset — exclude SAH (urgent CT + LP)');
    if (payload.progressive)        redFlags.push('Progressive headache — exclude raised ICP (CT/MRI)');
    if (payload.fever_neck_stiffness) redFlags.push('Fever + neck stiffness — exclude meningitis (LP)');
    if (payload.age > 50 && payload.new_headache) redFlags.push('New headache in >50 years — exclude giant cell arteritis (ESR/CRP)');
    if (payload.post_trauma)        redFlags.push('Post-traumatic — exclude subdural haematoma (CT)');
    if (payload.worse_on_exertion)  redFlags.push('Exertional headache — exclude intracranial lesion');
    if (payload.visual_symptoms && payload.jaw_claudication) redFlags.push('Visual symptoms + jaw claudication — giant cell arteritis');

    const primaryType = !redFlags.length
      ? (payload.unilateral && payload.pulsating && payload.nausea ? 'Migraine without aura (ICHD-3 1.1)' :
         payload.bilateral && payload.pressing ? 'Tension-type headache (ICHD-3 2.1)' :
         payload.cluster_features ? 'Cluster headache (ICHD-3 3.1)' : 'Primary headache — further characterisation needed')
      : null;

    return {
      source: 'local_fallback',
      red_flags: redFlags,
      emergency: redFlags.length > 0,
      probable_primary_type: primaryType,
      recommendation: redFlags.length
        ? `Emergency investigation required: ${redFlags.join('; ')}`
        : `Probable ${primaryType}. Acute treatment and prophylaxis based on frequency and disability (MIDAS/HIT-6).`,
      guideline: 'ICHD-3 2018; NICE NG150 2021',
    };
  }
}
