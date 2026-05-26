import { Injectable } from '@nestjs/common';

export interface StabilityInput {
  vlSuppressedMonths: number;
  adherencePct: number;
  hasActiveOiAlert: boolean;
  hasActiveWhoStage3or4: boolean;
  missedVisitsLast12Months: number;
}

@Injectable()
export class HivFastTrackService {
  isEligibleForFastTrack(input: StabilityInput): { eligible: boolean; reason: string } {
    if (input.vlSuppressedMonths < 6) {
      return { eligible: false, reason: 'VL suppression < 6 months' };
    }
    if (input.adherencePct < 95) {
      return { eligible: false, reason: `Adherence ${input.adherencePct}% < 95% required` };
    }
    if (input.hasActiveOiAlert) {
      return { eligible: false, reason: 'Active opportunistic infection alert' };
    }
    if (input.hasActiveWhoStage3or4) {
      return { eligible: false, reason: 'Active WHO Stage 3 or 4 condition' };
    }
    if (input.missedVisitsLast12Months > 1) {
      return { eligible: false, reason: `${input.missedVisitsLast12Months} missed visits in last 12 months` };
    }
    return { eligible: true, reason: 'Patient meets all stability criteria' };
  }

  recommendedMmdMonths(vlSuppressedMonths: number, adherencePct: number): 3 | 6 {
    return vlSuppressedMonths >= 12 && adherencePct >= 98 ? 6 : 3;
  }

  async classifyAndSave(
    patientId: string,
    input: StabilityInput,
    classifiedBy: string,
    db: any,
  ): Promise<{ eligible: boolean; mmdMonths?: 3 | 6; reason: string }> {
    const result = this.isEligibleForFastTrack(input);

    if (result.eligible) {
      const mmdMonths = this.recommendedMmdMonths(input.vlSuppressedMonths, input.adherencePct);
      const nextVisit = new Date();
      nextVisit.setMonth(nextVisit.getMonth() + mmdMonths);

      await db.query(
        `INSERT INTO hiv_stable_patient_flags (patient_id, stable_since, mmd_months, next_visit_due, classified_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)
         ON CONFLICT (patient_id) DO UPDATE SET
           mmd_months = EXCLUDED.mmd_months,
           next_visit_due = EXCLUDED.next_visit_due,
           classified_by = EXCLUDED.classified_by,
           is_active = true,
           updated_at = now()`,
        [patientId, mmdMonths, nextVisit.toISOString().split('T')[0], classifiedBy],
      );
      return { eligible: true, mmdMonths, reason: result.reason };
    }

    await db.query(
      `UPDATE hiv_stable_patient_flags
       SET is_active = false, deactivated_at = now(), deactivation_reason = $1
       WHERE patient_id = $2 AND is_active = true`,
      [result.reason, patientId],
    );
    return { eligible: false, reason: result.reason };
  }
}
