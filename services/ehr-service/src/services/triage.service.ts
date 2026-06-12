import { Injectable, Logger, Optional } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { ClinicalEscalationTask } from '../entities/clinical-escalation-task.entity';
import { TenantService } from './tenant.service';
import { AllergyService } from './allergy.service';
import { TerminologyService } from './terminology.service';
import { CdssHookService } from './cdss-hook.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';
import { NurseTaskService } from './nurse-task.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private tenantService: TenantService,
    private allergyService: AllergyService,
    private terminologyService: TerminologyService,
    private cdssHookService: CdssHookService,
    @Optional() private nurseTaskService?: NurseTaskService,
    @Optional() private workflowService?: ClinicalWorkflowService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<TriageAssessment>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(TriageAssessment);
  }

  /**
   * Parse allergies text into structured allergy objects
   * Supports formats like: "Penicillin (rash)", "Aspirin: severe", "None", "NKDA"
   */
  private parseAllergiesText(
    allergiesText: string,
  ): Array<{ allergen: string; reaction?: string; severity?: 'mild' | 'moderate' | 'severe' }> {
    if (!allergiesText || !allergiesText.trim()) {
      return [];
    }

    const normalized = allergiesText.trim().toUpperCase();
    
    // Handle common "no allergies" indicators
    if (normalized === 'NONE' || normalized === 'NKA' || normalized === 'NKDA' || normalized === 'NO KNOWN ALLERGIES') {
      return [];
    }

    const allergies: Array<{ allergen: string; reaction?: string; severity?: 'mild' | 'moderate' | 'severe' }> = [];
    const lines = allergiesText.split(/[,;\n\r]+/).map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      if (!line) continue;

      let allergen = line;
      let reaction: string | undefined;
      let severity: string | undefined;

      // Try to extract reaction and severity from patterns like:
      // "Penicillin (rash)" or "Aspirin: severe" or "Latex - severe reaction"
      const parenMatch = line.match(/^(.+?)\s*\((.+?)\)$/);
      const colonMatch = line.match(/^(.+?):\s*(.+)$/);
      const dashMatch = line.match(/^(.+?)\s*-\s*(.+)$/);

      if (parenMatch) {
        allergen = parenMatch[1].trim();
        const details = parenMatch[2].trim();
        // Check if it's severity or reaction
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (colonMatch) {
        allergen = colonMatch[1].trim();
        const details = colonMatch[2].trim();
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (dashMatch) {
        allergen = dashMatch[1].trim();
        const details = dashMatch[2].trim();
        if (details.toLowerCase().includes('severe')) {
          severity = 'severe';
          reaction = details;
        } else if (details.toLowerCase().includes('moderate')) {
          severity = 'moderate';
          reaction = details;
        } else if (details.toLowerCase().includes('mild')) {
          severity = 'mild';
          reaction = details;
        } else {
          reaction = details;
        }
      }

      if (allergen) {
        allergies.push({
          allergen: allergen.trim(),
          reaction: reaction || undefined,
          severity: (severity as 'mild' | 'moderate' | 'severe' | undefined) || undefined,
        });
      }
    }

    return allergies;
  }

  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomed_code ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for triage payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) ||
      null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  private async normalizeConceptArray(
    tenantDb: DataSource,
    rawList: any,
  ): Promise<StoredConceptSummary[]> {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    const normalized: StoredConceptSummary[] = [];
    for (const entry of rawList) {
      const resolved = await this.resolveConcept(tenantDb, entry);
      if (resolved) {
        normalized.push(resolved);
      }
    }
    return normalized;
  }

  private deriveTriageEscalation(saved: any) {
    const priority = String(saved.priority || '').toLowerCase();
    const severityScore = Number(saved.severity_score ?? saved.severityScore ?? 0);
    const painScore = Number(saved.pain_score ?? saved.painScore ?? 0);

    if (priority !== 'urgent' && priority !== 'high' && severityScore < 7 && painScore < 8) {
      return null;
    }

    const severity =
      priority === 'urgent' || severityScore >= 9 ? 'critical' :
      priority === 'high' || severityScore >= 7 ? 'high' :
      'medium';

    const summaryParts = [
      `Triage priority ${saved.priority || 'unknown'}`,
      Number.isFinite(severityScore) && severityScore > 0 ? `severity score ${severityScore}` : null,
      Number.isFinite(painScore) && painScore > 0 ? `pain score ${painScore}` : null,
      saved.chief_complaint ? `chief complaint: ${saved.chief_complaint}` : null,
    ].filter(Boolean);

    return {
      severity,
      title: `Triage escalation for patient ${saved.patient_id || saved.patientId}`,
      summary: summaryParts.join(', '),
      recommendedAction:
        severity === 'critical'
          ? 'Immediate nurse escalation and clinician review from triage.'
          : 'Prompt nurse review and reassessment from triage.',
      dueAtMinutes: severity === 'critical' ? 10 : 30,
    };
  }

  private async createTriageEscalationTask(
    tenantDb: DataSource,
    tenantId: string,
    saved: any,
    observationConcepts: StoredConceptSummary[],
  ): Promise<string | null> {
    const escalation = this.deriveTriageEscalation(saved);
    if (!escalation) {
      return null;
    }

    const dueAt = new Date();
    dueAt.setMinutes(dueAt.getMinutes() + escalation.dueAtMinutes);

    const escalationRepo = tenantDb.getRepository(ClinicalEscalationTask);
    const escalationTask = escalationRepo.create({
      patientId: saved.patient_id,
      earlyWarningScoreId: null,
      nurseTaskId: null,
      sourceModule: 'triage',
      sourceReferenceId: saved.id,
      escalationType: 'triage_priority_review',
      severity: escalation.severity,
      status: 'open',
      title: escalation.title,
      summary: escalation.summary,
      recommendedAction: escalation.recommendedAction,
      assignedTo: null,
      dueAt,
      acknowledgedBy: null,
      acknowledgedAt: null,
      completedBy: null,
      completedAt: null,
      evidence: {
        priority: saved.priority,
        severityScore: saved.severity_score,
        painScore: saved.pain_score,
        chiefComplaint: saved.chief_complaint,
      },
      metadata: {
        chiefComplaintConcept: saved.chief_complaint_snomed_code
          ? {
              conceptId: saved.chief_complaint_snomed_code,
              term: saved.chief_complaint_snomed_term,
            }
          : null,
        observationConcepts,
      },
    });

    const savedEscalation = await escalationRepo.save(escalationTask);

    if (this.nurseTaskService) {
      const nurseTask = await this.nurseTaskService.createTask(
        {
          patientId: saved.patient_id,
          assignedBySystem: true,
          taskType: 'triage_priority_review',
          priority: escalation.severity === 'critical' ? 'urgent' : 'high',
          title: 'Triage escalation review',
          description: escalation.summary,
          dueDate: dueAt.toISOString(),
          sourceType: 'clinical_escalation',
          sourceId: savedEscalation.id,
        },
        tenantDb,
        tenantId,
      );

      savedEscalation.nurseTaskId = nurseTask.id;
      await escalationRepo.save(savedEscalation);
    }

    return savedEscalation.id;
  }

  async recordAssessment(data: Partial<TriageAssessment>, tenantId: string): Promise<TriageAssessment> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Resolve SNOMED concepts
    const chiefComplaintConcept = await this.resolveConcept(tenantDb, data.chiefComplaintSnomedCode || (data as any).chief_complaint_snomed);
    const observationsList = await this.normalizeConceptArray(tenantDb, (data as any).observations_snomed || data.observationsSnomed);
    const symptomsList = await this.normalizeConceptArray(tenantDb, (data as any).symptoms_snomed || data.symptomsSnomed);
    const medicationsList = await this.normalizeConceptArray(tenantDb, (data as any).medications_snomed || data.medicationsSnomed);
    const historyList = await this.normalizeConceptArray(tenantDb, (data as any).history_snomed || data.historySnomed);

    // Use raw SQL to insert with SNOMED fields
    const result = await tenantDb.query(
      `
      INSERT INTO triage_assessments (
        patient_id, chief_complaint, chief_complaint_snomed_code, chief_complaint_snomed_term,
        chief_complaint_snomed_module_id, chief_complaint_snomed_definition_status,
        onset, pain_score, allergies, medications, history, observations, observations_snomed,
        symptoms, symptoms_snomed, medications_snomed, history_snomed,
        priority, severity_score, recorded_at, recorded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, $16::jsonb, $17::jsonb, $18, $19, $20, $21)
      RETURNING *
      `,
      [
        data.patientId,
        data.chiefComplaint,
        chiefComplaintConcept?.conceptId ?? null,
        chiefComplaintConcept?.term ?? null,
        chiefComplaintConcept?.moduleId ?? null,
        chiefComplaintConcept?.definitionStatus ?? null,
        data.onset ?? null,
        data.painScore ?? null,
        data.allergies ?? null,
        data.medications ?? null,
        data.history ?? null,
        data.observations ?? null,
        JSON.stringify(observationsList),
        data.symptoms ?? null,
        JSON.stringify(symptomsList),
        JSON.stringify(medicationsList),
        JSON.stringify(historyList),
        data.priority,
        data.severityScore ?? null,
        data.recordedAt ?? new Date(),
        data.recordedBy,
      ],
    );

    const saved = result[0];
    const escalationTaskId = await this.createTriageEscalationTask(
      tenantDb,
      tenantId,
      saved,
      observationsList,
    );

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleTriageAssessment({
        tenantId,
        tenantDb,
        assessment: saved,
        chiefComplaintConcept,
        observationConcepts: observationsList,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for triage assessment: ${error instanceof Error ? error.message : error}`);
    }

    // Sync allergies from triage text to structured allergies table
    if (data.allergies && data.patientId && data.recordedBy) {
      try {
        const parsedAllergies = this.parseAllergiesText(data.allergies);
        
        // Only update if there are actually parsed allergies (avoid clearing existing)
        // If text is empty or "none", we don't overwrite existing structured allergies
        if (parsedAllergies.length > 0) {
          await this.allergyService.replaceForPatient(
            data.patientId as string,
            parsedAllergies,
            data.recordedBy as string,
            tenantId
          );
        }
      } catch (e) {
        // Log but don't fail triage save if allergy sync fails
        console.error('Failed to sync allergies from triage:', e);
      }
    }

    // Trigger workflow for triage_completed
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'triage_completed',
          {
            entityType: 'triage_assessment',
            entityId: saved.id,
            patientId: saved.patient_id,
            data: {
              priority: saved.priority,
              severityScore: saved.severity_score,
              chiefComplaint: saved.chief_complaint,
            },
          },
          tenantDb,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for triage_completed: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      ...saved,
      cdssInsights,
      escalationTaskId,
    };
  }

  async getByPatient(patientId: string, tenantId: string): Promise<TriageAssessment[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }

  // ── SATS / ESI scoring ─────────────────────────────────────────────────────

  satsScore(payload: Record<string, any>): Record<string, any> {
    return calculateSats(payload);
  }

  newsScore(payload: Record<string, any>): Record<string, any> {
    return calculateNews2(payload);
  }

  codeBlueProtocol(payload: Record<string, any>): Record<string, any> {
    return codeBlueWorkflow(payload);
  }
}

// ── South African Triage Scale (SATS) ────────────────────────────────────────

function calculateSats(p: Record<string, any>): Record<string, any> {
  // Trauma/injury score (TIS): GCS + RR + SBP components
  const gcs = Number(p.gcs ?? 15);
  const rr = Number(p.respiratoryRate ?? p.rr ?? 16);
  const sbp = Number(p.systolicBp ?? p.sbp ?? 120);

  let tis = 0;
  // GCS contribution (0–4)
  if (gcs >= 14) tis += 4;
  else if (gcs >= 11) tis += 3;
  else if (gcs >= 8) tis += 2;
  else if (gcs >= 5) tis += 1;

  // RR contribution (0–4)
  if (rr >= 10 && rr <= 29) tis += 4;
  else if (rr > 29) tis += 3;
  else if (rr >= 6 && rr <= 9) tis += 2;
  else if (rr >= 1 && rr <= 5) tis += 1;

  // SBP contribution (0–4)
  if (sbp > 89) tis += 4;
  else if (sbp >= 76) tis += 3;
  else if (sbp >= 50) tis += 2;
  else if (sbp >= 1) tis += 1;

  // Clinical discriminators (override to immediate/very urgent)
  const discriminators: string[] = [];
  if (gcs <= 8) discriminators.push('Impaired consciousness (GCS≤8)');
  if (!isNaN(Number(p.spo2)) && Number(p.spo2) < 90) discriminators.push('SpO2 <90%');
  if (p.activeHaemorrhage) discriminators.push('Active haemorrhage');
  if (p.airwayObstruction) discriminators.push('Airway obstruction');
  if (p.currentSeizure) discriminators.push('Current seizure');
  if (p.acuteChestPain) discriminators.push('Acute chest pain');
  if (p.strokeSigns) discriminators.push('Stroke signs (FAST positive)');
  if (p.eclampsiaFeatures) discriminators.push('Eclampsia features');

  let category: string, colour: string, waitTime: string, action: string;

  if (discriminators.length > 0 || tis <= 8) {
    category = '1'; colour = 'RED'; waitTime = 'Immediate';
    action = 'Immediate resuscitation; call senior/doctor now; prepare resus bay';
  } else if (tis <= 11 || p.severeDistress) {
    category = '2'; colour = 'ORANGE'; waitTime = '≤10 minutes';
    action = 'Very urgent; continuous observation; early senior review';
  } else if (p.moderateDistress || Number(p.painScore ?? 0) >= 7) {
    category = '3'; colour = 'YELLOW'; waitTime = '≤1 hour';
    action = 'Urgent; regular monitoring; analgesic if needed';
  } else if (tis === 12 && !p.severeDistress) {
    category = '4'; colour = 'GREEN'; waitTime = '≤4 hours';
    action = 'Routine; nurse-led triage; can wait';
  } else {
    category = '5'; colour = 'BLUE'; waitTime = 'Refer/self-care';
    action = 'Non-urgent; refer to clinic or pharmacy; no immediate risk';
  }

  return {
    source: 'local_sats',
    traumaInjuryScore: tis,
    category,
    colour,
    waitTime,
    action,
    discriminators,
    inputs: { gcs, rr, sbp },
    guideline: 'South African Triage Scale (SATS) 4th Edition; adaptable to Zimbabwean ED settings',
  };
}

// ── NEWS2 (National Early Warning Score 2) ────────────────────────────────────

function calculateNews2(p: Record<string, any>): Record<string, any> {
  let score = 0;
  const components: Record<string, number> = {};

  const rr = Number(p.respiratoryRate ?? p.rr ?? NaN);
  const spo2 = Number(p.spo2 ?? NaN);
  const sbp = Number(p.systolicBp ?? p.sbp ?? NaN);
  const hr = Number(p.heartRate ?? p.hr ?? NaN);
  const temp = Number(p.temperature ?? p.temp ?? NaN);
  const gcs = Number(p.gcs ?? 15);
  const onO2 = !!p.onSupplementalOxygen;

  if (!isNaN(rr)) {
    const rrScore = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
    score += rrScore; components['rr'] = rrScore;
  }
  if (!isNaN(spo2)) {
    const spScore = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
    score += spScore; components['spo2'] = spScore;
  }
  if (onO2) { score += 2; components['supplementalO2'] = 2; }
  if (!isNaN(sbp)) {
    const bpScore = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
    score += bpScore; components['sbp'] = bpScore;
  }
  if (!isNaN(hr)) {
    const hrScore = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
    score += hrScore; components['hr'] = hrScore;
  }
  if (!isNaN(temp)) {
    const tScore = temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2;
    score += tScore; components['temp'] = tScore;
  }
  if (gcs < 15) { score += 3; components['consciousness'] = 3; }

  let risk: string, response: string;
  if (score >= 7 || components['consciousness'] === 3) {
    risk = 'HIGH'; response = 'URGENT escalation: continuous monitoring; senior review NOW; consider ICU/HDU transfer';
  } else if (score >= 5) {
    risk = 'MEDIUM'; response = 'Urgent review by senior nurse/doctor; monitor ≥30 min; consider HDU';
  } else if (score >= 3) {
    risk = 'LOW_MEDIUM'; response = 'Review by nurse/doctor; increase monitoring frequency to ≥1 hourly';
  } else {
    risk = 'LOW'; response = 'Routine monitoring; 4–6 hourly observations';
  }

  return { source: 'local_news2', score, risk, response, components, guideline: 'NEWS2 — Royal College of Physicians 2017' };
}

// ── Code Blue Workflow ────────────────────────────────────────────────────────

function codeBlueWorkflow(p: Record<string, any>): Record<string, any> {
  const triggerReason = String(p.triggerReason ?? '').toLowerCase();
  const hasPulse = p.hasPulse !== false;
  const isBreathing = p.isBreathing !== false;

  const immediateActions = [
    '1. CALL FOR HELP — activate code blue team/resus team immediately',
    '2. Lay patient flat; ensure airway patent (head-tilt chin-lift or jaw thrust if trauma)',
    '3. If no pulse: start CPR immediately — 30 compressions : 2 breaths; 100-120/min',
    '4. Attach defibrillator/AED as soon as available',
    '5. Obtain IV access; 0.9% NaCl 250 ml bolus if hypotensive',
    '6. Administer oxygen (high-flow 15 L/min via non-rebreather mask)',
    '7. Check blood glucose; treat hypoglycaemia if confirmed (50 ml 50% dextrose IV)',
    '8. Assign roles: airway, compressions, IV access, medications, recorder',
  ];

  const rhythmActions: Record<string, string[]> = {
    vf_vt: [
      'Shockable rhythm (VF/pulseless VT)',
      'Defibrillate: 200 J biphasic (or 360 J monophasic); resume CPR immediately for 2 min',
      'Adrenaline 1 mg IV after 3rd shock then every 3-5 min',
      'Amiodarone 300 mg IV after 3rd shock; repeat 150 mg after 5th shock',
    ],
    asystole_pea: [
      'Non-shockable rhythm (Asystole/PEA)',
      'Adrenaline 1 mg IV ASAP; repeat every 3-5 min',
      'Treat reversible causes: 4 H\'s (Hypoxia, Hypovolaemia, Hypo/Hyperkalaemia, Hypothermia) + 4 T\'s (Tension pneumothorax, Tamponade, Toxins, Thromboembolism)',
    ],
  };

  const returnOfCirculation = [
    'Post-ROSC: maintain SpO2 94–98%; target SBP >100 mmHg',
    'Targeted temperature management: avoid fever (>37.8°C); cooling if comatose post-arrest',
    'Urgent 12-lead ECG; consider PPCI if STEMI or suspected cardiac cause',
    'Transfer to ICU/HDU; glucose control 4-10 mmol/L',
  ];

  const isShockable = triggerReason.includes('vf') || triggerReason.includes('vt') || triggerReason.includes('shockable');
  const rhythmGuide = isShockable ? rhythmActions.vf_vt : rhythmActions.asystole_pea;

  return {
    source: 'local_als_protocol',
    codeBlueActivated: true,
    immediateActions,
    rhythmSpecificActions: rhythmGuide,
    postROSC: returnOfCirculation,
    drugDosing: {
      adrenaline: '1 mg (1:10,000) IV every 3-5 min during CPR',
      amiodarone: '300 mg IV first dose; 150 mg second dose',
      atropine: 'NOT routinely recommended (removed from ALS 2021 guidelines)',
      dextrose: '50 ml of 50% dextrose for documented hypoglycaemia',
    },
    guideline: 'ALS Algorithm — Resuscitation Council UK 2021; Zimbabwe Emergency Medicine guidelines',
  };
}
