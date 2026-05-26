import { Injectable } from '@nestjs/common';

interface HitsScores {
  hurt: number;
  insult: number;
  threaten: number;
  scream: number;
}

@Injectable()
export class GbvService {
  calculateHitsScore(hits: HitsScores): number {
    return hits.hurt + hits.insult + hits.threaten + hits.scream;
  }

  classifyDanger(
    hitsTotal: number,
    additionalFactors: { weaponInHome: boolean; escalatingViolence: boolean },
  ): 'safe' | 'moderate_risk' | 'high_risk' | 'imminent_danger' {
    if (additionalFactors.weaponInHome || (hitsTotal >= 16 && additionalFactors.escalatingViolence)) {
      return 'imminent_danger';
    }
    if (hitsTotal >= 16 || additionalFactors.escalatingViolence) return 'high_risk';
    if (hitsTotal >= 11) return 'moderate_risk';
    return 'safe';
  }

  async createGbvAssessment(params: {
    patientId: string;
    screenedBy: string;
    hits: HitsScores;
    dangerAssessment: string;
    safetyPlanCreated: boolean;
    safetyPlanNotes?: string;
    referredTo?: string;
    followUpDate?: string;
    db: any;
  }): Promise<any> {
    const total = this.calculateHitsScore(params.hits);
    const screenPositive = total >= 11;

    const [row] = await params.db.query(
      `INSERT INTO gbv_assessments
         (patient_id, screened_by, screen_date, hits_hurt, hits_insult, hits_threaten, hits_scream,
          hits_total, screen_positive, danger_assessment, safety_plan_created, safety_plan_notes,
          referred_to, follow_up_date)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        params.patientId, params.screenedBy,
        params.hits.hurt, params.hits.insult, params.hits.threaten, params.hits.scream,
        total, screenPositive, params.dangerAssessment, params.safetyPlanCreated,
        params.safetyPlanNotes ?? null, params.referredTo ?? null, params.followUpDate ?? null,
      ],
    );
    return row;
  }

  async getGbvHistory(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM gbv_assessments WHERE patient_id = $1 ORDER BY screen_date DESC`,
      [patientId],
    );
  }
}
