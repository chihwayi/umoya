import { Injectable, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AbstentionLogService } from './abstention-log.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { TenantService } from './tenant.service';
import { ClinicalLlmService } from './clinical-llm.service';

export type Modality = 'in_person' | 'telemedicine' | 'phone';
export type Urgency = 'urgent' | 'soon' | 'routine';

export interface FollowUpRecommendation {
  id: number;
  patientId: number;
  recommendedDays: number;
  recommendedModality: Modality;
  urgency: Urgency;
  reasoning: string;
  aiSource: string;
}

@Injectable()
export class FollowUpRecommendationService {
  constructor(
    @Optional() private readonly abstentionLog?: AbstentionLogService,
    @Optional() private readonly alertDelivery?: AlertDeliveryService,
    @Optional() @Inject(TenantService) private readonly tenantService?: TenantService,
    @Optional() private readonly llm?: ClinicalLlmService,
  ) {}

  async generateRecommendation(
    db: any,
    params: {
      patientId: number;
      encounterId?: number;
      encounterType: 'consultation' | 'telemedicine' | 'discharge';
      riskBand: 'low' | 'moderate' | 'high' | 'critical';
      diagnoses: string[];
      openCareGapsCount: number;
      medicationsChanged: boolean;
      subdomain: string;
    },
  ): Promise<FollowUpRecommendation> {
    const { patientId, encounterId, encounterType, riskBand, diagnoses,
      openCareGapsCount, medicationsChanged } = params;

    const { days, modality } = this.computeInterval(riskBand, encounterType, diagnoses);
    let reasoning = this.buildBaseReasoning(riskBand, encounterType, diagnoses, medicationsChanged, openCareGapsCount);
    const urgency = this.computeUrgency(riskBand, days);
    const dueBy = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    let aiSource = 'rule';

    if (this.llm) {
      const prompt =
        `You are a clinical decision support assistant. Write a concise 2-sentence follow-up ` +
        `plan for a clinician.\nPatient risk: ${riskBand}\nEncounter type: ${encounterType}\n` +
        `Active diagnoses: ${diagnoses.slice(0, 3).join(', ') || 'not provided'}\n` +
        `Medications changed: ${medicationsChanged ? 'yes' : 'no'}\n` +
        `Open care gaps: ${openCareGapsCount}\n` +
        `Recommended: ${days} days (${modality}), urgency: ${urgency}\n` +
        `Write an actionable clinical rationale. State what to monitor and why. ` +
        `Do not start with "The patient" or "Patient".`;

      try {
        const result = await this.llm.generate(
          prompt,
          { context: 'followup_recommendation', maxTokens: 200, temperature: 0.3 },
          db,
        );
        if (result && result.text.length > 30) {
          reasoning = result.text;
          aiSource = `llm:${result.backend}`;
        } else {
          await this.abstentionLog?.log(db, 'followup_recommendation', 'low_confidence', {});
        }
      } catch {
        // Rule reasoning already set
      }
    }

    const rows = await db.query(
      `INSERT INTO followup_recommendations
         (patient_id, encounter_id, encounter_type, recommended_days,
          recommended_modality, urgency, reasoning, ai_source, appointment_due_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [patientId, encounterId ?? null, encounterType, days, modality,
       urgency, reasoning, aiSource, dueBy],
    );

    return {
      id: rows[0].id,
      patientId,
      recommendedDays: days,
      recommendedModality: modality,
      urgency,
      reasoning,
      aiSource,
    };
  }

  async acceptRecommendation(
    db: any,
    id: number,
    acceptedBy: number,
    override?: { days?: number; modality?: string },
  ): Promise<void> {
    await db.query(
      `UPDATE followup_recommendations
         SET accepted_by = $1, accepted_at = NOW(),
             clinician_override_days = $2,
             clinician_override_modality = $3,
             appointment_due_by = CASE
               WHEN $2 IS NOT NULL
               THEN NOW() + ($2::integer * INTERVAL '1 day')
               ELSE appointment_due_by
             END,
             updated_at = NOW()
       WHERE id = $4`,
      [acceptedBy, override?.days ?? null, override?.modality ?? null, id],
    );
  }

  async dismissRecommendation(db: any, id: number, dismissedBy: number): Promise<void> {
    await db.query(
      `UPDATE followup_recommendations
         SET dismissed_by = $1, dismissed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [dismissedBy, id],
    );
  }

  async markAppointmentBooked(db: any, recommendationId: number): Promise<void> {
    await db.query(
      `UPDATE followup_recommendations
         SET appointment_booked = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [recommendationId],
    );
  }

  async getPatientRecommendations(db: any, patientId: number): Promise<any[]> {
    return db.query(
      `SELECT * FROM followup_recommendations
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 10`,
      [patientId],
    );
  }

  async getOverdueFollowUps(db: any): Promise<any[]> {
    return db.query(
      `SELECT fr.*, p.full_name, p.mrn
         FROM followup_recommendations fr
         JOIN patients p ON p.id = fr.patient_id
        WHERE fr.appointment_booked = FALSE
          AND fr.dismissed_at IS NULL
          AND fr.accepted_at IS NOT NULL
          AND fr.appointment_due_by < NOW()
          AND fr.overdue_alerted = FALSE
        ORDER BY fr.urgency DESC, fr.appointment_due_by ASC`,
      [],
    );
  }

  @Cron('0 7 * * *')
  async sweepOverdueFollowUps(): Promise<void> {
    if (!this.tenantService) return;
    const tenants = await this.tenantService!.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService!.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const overdue = await this.getOverdueFollowUps(db);
        for (const row of overdue) {
          await this.alertDelivery?.broadcastCriticalAlert(tenant.subdomain, {
            alertType: 'overdue_followup',
            sourceEntityId: String(row.id),
            patientId: String(row.patient_id),
            severity: row.urgency === 'urgent' ? 'critical' : 'high',
            message: `Overdue follow-up: ${row.full_name} (MRN ${row.mrn}) — ` +
                     `was due ${new Date(row.appointment_due_by).toLocaleDateString()}`,
          });
          await db.query(
            `UPDATE followup_recommendations
               SET overdue_alerted = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [row.id],
          );
        }
      } catch {
        // Continue to next tenant
      }
    }
  }

  private computeInterval(
    risk: string, encounterType: string, diagnoses: string[],
  ): { days: number; modality: Modality } {
    if (risk === 'critical') return { days: 2, modality: 'in_person' };
    if (encounterType === 'discharge') return { days: 7, modality: 'in_person' };
    if (risk === 'high') return { days: 7, modality: 'in_person' };

    const seriousDx = diagnoses.some(d => {
      const l = d.toLowerCase();
      return l.includes('cancer') || l.includes('hiv') || l.includes('tb') ||
             l.includes('tuberculosis') || l.includes('lymphoma') || l.includes('leukemia');
    });

    if (risk === 'moderate' && seriousDx) return { days: 14, modality: 'in_person' };
    if (risk === 'moderate') return { days: 21, modality: 'telemedicine' };
    if (encounterType === 'telemedicine') return { days: 30, modality: 'phone' };
    return { days: 30, modality: 'telemedicine' };
  }

  private computeUrgency(risk: string, days: number): Urgency {
    if (risk === 'critical' || days <= 3) return 'urgent';
    if (days <= 14) return 'soon';
    return 'routine';
  }

  private buildBaseReasoning(
    risk: string, encounterType: string, diagnoses: string[],
    medicationsChanged: boolean, openGaps: number,
  ): string {
    const parts: string[] = [];
    if (risk === 'critical' || risk === 'high') parts.push(`Patient is ${risk}-risk.`);
    if (encounterType === 'discharge') parts.push('Post-discharge follow-up required.');
    if (medicationsChanged) parts.push('Medications were adjusted this encounter.');
    if (openGaps > 0) parts.push(`${openGaps} open care gap(s) require monitoring.`);
    if (diagnoses.length) parts.push(`Active diagnoses: ${diagnoses.slice(0, 3).join(', ')}.`);
    return parts.join(' ') || 'Routine follow-up as per clinical protocol.';
  }
}
