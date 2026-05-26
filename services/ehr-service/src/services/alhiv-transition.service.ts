import { Injectable } from '@nestjs/common';

interface TraqScores {
  knowsDiagnosis: number;
  knowsMedications: number;
  managesOwnMedications: number;
  attendsAppointmentsAlone: number;
  communicatesWithProvider: number;
  understandsConfidentiality: number;
}

@Injectable()
export class AlhivTransitionService {
  calculateTransitionReadiness(params: TraqScores): {
    totalScore: number;
    readinessLevel: 'low' | 'moderate' | 'high';
    recommendation: string;
  } {
    const totalScore = Object.values(params).reduce((a, b) => a + b, 0);

    if (totalScore < 12) {
      return {
        totalScore,
        readinessLevel: 'low',
        recommendation:
          'Continue paediatric care. Intensive preparation programme required. Focus on disease knowledge and self-management skills.',
      };
    }
    if (totalScore < 21) {
      return {
        totalScore,
        readinessLevel: 'moderate',
        recommendation:
          'Begin formal transition preparation. Identify adult provider. Practice self-management with decreasing support.',
      };
    }
    return {
      totalScore,
      readinessLevel: 'high',
      recommendation:
        'Patient ready for transition. Identify adult provider, schedule joint handover appointment, issue transfer letter.',
    };
  }

  async createTransitionAssessment(params: {
    patientId: string;
    assessedBy: string;
    patientAge: number;
    scores: TraqScores;
    adultProviderName?: string;
    adultFacilityName?: string;
    targetTransferDate?: string;
    notes?: string;
    db: any;
  }): Promise<any> {
    const readiness = this.calculateTransitionReadiness(params.scores);
    const stage = readiness.readinessLevel === 'high' ? 'transition_preparation' : 'pre_transition';

    const [row] = await params.db.query(
      `INSERT INTO alhiv_transition_assessments
         (patient_id, assessment_date, assessed_by, patient_age,
          knows_diagnosis, knows_medications, manages_own_medications,
          attends_appointments_alone, communicates_with_provider, understands_confidentiality,
          adult_provider_name, adult_facility_name, transition_stage, target_transfer_date, notes)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        params.patientId, params.assessedBy, params.patientAge,
        params.scores.knowsDiagnosis, params.scores.knowsMedications,
        params.scores.managesOwnMedications, params.scores.attendsAppointmentsAlone,
        params.scores.communicatesWithProvider, params.scores.understandsConfidentiality,
        params.adultProviderName ?? null, params.adultFacilityName ?? null,
        stage, params.targetTransferDate ?? null, params.notes ?? null,
      ],
    );
    return { ...row, readiness };
  }

  async markTransferred(assessmentId: string, transferDate: string, db: any): Promise<void> {
    await db.query(
      `UPDATE alhiv_transition_assessments
       SET transition_stage = 'transferred', actual_transfer_date = $1,
           post_transfer_follow_up_due = $1::DATE + interval '3 months'
       WHERE id = $2`,
      [transferDate, assessmentId],
    );
  }
}
