import { Injectable } from '@nestjs/common';
import axios from 'axios';

const DAPT_FACTORS: Record<string, number> = {
  age_lt_65: 2,
  age_65_75: -1,
  age_gt_75: -2,
  current_smoker: 1,
  diabetes: 1,
  prior_pci: 1,
  prior_mi: 1,
  paclitaxel_stent: 1,
  stent_diameter_lt3mm: 1,
  chf_lvef_lt30: 2,
  saphenous_vein_graft: 2,
};

function selectP2Y12Agent(indication: string, bleedingRisk: boolean, stentType: string): string {
  if (stentType === 'cabg') return 'aspirin_only';
  if (indication === 'acs' && !bleedingRisk) return 'ticagrelor_90mg_bd';
  if (indication === 'acs' && bleedingRisk) return 'clopidogrel_75mg_od';
  return 'clopidogrel_75mg_od';
}

function selectDuration(daptScore: number, bleedingRisk: boolean, stentType: string): number {
  if (stentType === 'bms') return 1;
  if (bleedingRisk) return 6;
  if (daptScore >= 2) return 30;
  return 12;
}

// Suppress unused-variable warning — DAPT_FACTORS is defined for reference/future use
void DAPT_FACTORS;

@Injectable()
export class CathLabAiService {
  constructor() {}

  async recordEcgInterpretation(db: any, reviewedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_ecg_interpretations
         (case_id, patient_id, leads_affected, max_st_elev_mm, territory, sgarbossa_score, ai_impression, ai_confidence, reviewed_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        body.caseId, body.patientId,
        JSON.stringify(body.leadsAffected ?? []),
        body.maxStElevMm ?? null,
        body.territory ?? null,
        body.sgarbossaScore ?? null,
        body.aiImpression ?? null,
        body.aiConfidence ?? null,
        reviewedBy,
      ],
    );
    return rows[0] ?? null;
  }

  async computeContrastRisk(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_contrast_risk
         (case_id, patient_id, hypotension, iabp_use, chf_present, age_gt_75, anaemia, diabetes,
          contrast_volume_ml, creatinine_umol_l, egfr_ml_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *, mehran_score`,
      [
        body.caseId, body.patientId,
        body.hypotension, body.iabpUse, body.chfPresent, body.ageGt75,
        body.anaemia, body.diabetes,
        body.contrastVolumeMl ?? null,
        body.creatinineUmolL ?? null,
        body.egfrMlMin ?? null,
      ],
    );
    const result = rows[0];
    const score: number = result?.mehran_score ?? 0;

    let risk: string;
    let advice: string;
    if (score < 6) {
      risk = 'low';
      advice = 'Standard hydration. Routine post-procedure creatinine at 48h.';
    } else if (score < 11) {
      risk = 'moderate';
      advice = 'IV normal saline 1 ml/kg/h for 12h pre/post. Consider iso-osmolar contrast. Avoid NSAIDs.';
    } else if (score < 16) {
      risk = 'high';
      advice = 'Aggressive IV hydration. Minimum contrast volume. N-acetylcysteine 600 mg BD ×4 doses. Nephrology alert.';
    } else {
      risk = 'very_high';
      advice = 'Risk of dialysis >10%. Pre-procedure nephrology consult mandatory. Consider deferring if non-emergent.';
    }

    return { ...result, risk_level: risk, recommendation: advice };
  }

  async createDaptRecommendation(db: any, createdBy: string, body: any): Promise<any> {
    const daptScore = body.daptScore ?? 0;
    const agent = selectP2Y12Agent(body.indication, body.bleedingRiskHigh ?? false, body.stentType);
    const duration = selectDuration(daptScore, body.bleedingRiskHigh ?? false, body.stentType);

    let interactionFlags: any[] = [];
    if (body.currentMedications?.length) {
      try {
        const resp = await axios.post('http://localhost:8000/cathlab/cdss/drug-interaction', {
          p2y12_agent: agent,
          current_medications: body.currentMedications,
        });
        interactionFlags = (resp.data as any)?.flags ?? [];
      } catch {}
    }

    const rows = await db.query(
      `INSERT INTO cathlab_dapt_recommendations
         (case_id, patient_id, stent_type, indication, dapt_score, bleeding_risk_high,
          recommended_agent, recommended_duration_months, interaction_flags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING *`,
      [
        body.caseId, body.patientId,
        body.stentType, body.indication,
        daptScore, body.bleedingRiskHigh ?? false,
        agent, duration,
        JSON.stringify(interactionFlags),
        createdBy,
      ],
    );
    return rows[0] ?? null;
  }

  async recordSyntaxScore(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_syntax_scores (case_id, syntax_score, syntax_ii_score, assessed_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING *, complexity_tier, recommended_strategy`,
      [body.caseId, body.syntaxScore, body.syntaxIiScore ?? null, assessedBy],
    );
    return rows[0] ?? null;
  }

  async getQualityMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_quality_metrics LIMIT 24`);
  }

  async getCaseAiSummary(db: any, caseId: string): Promise<any> {
    const [ecg, risk, dapt, syntax] = await Promise.all([
      db.query(
        `SELECT * FROM cathlab_ecg_interpretations WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      db.query(
        `SELECT *, mehran_score FROM cathlab_contrast_risk WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      db.query(
        `SELECT * FROM cathlab_dapt_recommendations WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
      db.query(
        `SELECT *, complexity_tier, recommended_strategy FROM cathlab_syntax_scores WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      ),
    ]);
    return {
      ecg: ecg[0] ?? null,
      contrast_risk: risk[0] ?? null,
      dapt: dapt[0] ?? null,
      syntax: syntax[0] ?? null,
    };
  }
}
