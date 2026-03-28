import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { ClinicalOutcome } from './clinical-outcome.entity';

/**
 * Records every CDSS recommendation served to a clinician, the clinician's
 * response (accepted / modified / overridden / ignored), and links back to the
 * patient outcome once available.
 *
 * This is the foundational feedback loop for continuous AI improvement.
 * Provisioned in Sprint 61 — provision-sprint61-cdss-outcome-feedback.ts
 */
@Entity('cdss_decision_log')
export class CdssDecisionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Context ───────────────────────────────────────────────────────────────

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  /** Appointment / visit ID — nullable for async recommendations */
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId?: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // ── CDSS request/response snapshot ───────────────────────────────────────

  /**
   * One of: diagnosis | drug_interaction | dosing | risk | care_gap |
   * lab_interpretation | sepsis_alert | news2 | guideline
   */
  @Column({ name: 'decision_type', length: 60 })
  decisionType: string;

  /** Exact payload sent to the CDSS service */
  @Column({ name: 'cdss_request_payload', type: 'jsonb', default: {} })
  cdssRequestPayload: Record<string, any> = {};

  /** Full response returned by the CDSS service */
  @Column({ name: 'cdss_response_payload', type: 'jsonb', default: {} })
  cdssResponsePayload: Record<string, any> = {};

  /** Primary recommendation text surfaced to the clinician */
  @Column({ name: 'top_recommendation', type: 'text', nullable: true })
  topRecommendation?: string;

  /** 0.0000–1.0000 model confidence */
  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidenceScore?: number;

  // ── Clinician feedback ────────────────────────────────────────────────────

  @Column({
    name: 'clinician_action',
    length: 20,
    nullable: true,
  })
  clinicianAction?: 'accepted' | 'modified' | 'overridden' | 'ignored';

  /** Required when clinicianAction = 'overridden' */
  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string;

  // ── Outcome linkage ───────────────────────────────────────────────────────

  @Column({ name: 'patient_outcome_id', type: 'uuid', nullable: true })
  patientOutcomeId?: string;

  @ManyToOne(() => ClinicalOutcome, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_outcome_id' })
  patientOutcome?: ClinicalOutcome;

  /** Outcome snapshot at 30 days (populated by batch job) */
  @Column({ name: 'outcome_at_30_days', type: 'jsonb', nullable: true })
  outcomeAt30Days?: Record<string, any>;

  /** Outcome snapshot at 90 days (populated by batch job) */
  @Column({ name: 'outcome_at_90_days', type: 'jsonb', nullable: true })
  outcomeAt90Days?: Record<string, any>;

  // ── Feedback loop status ──────────────────────────────────────────────────

  /** True once outcome data has been pushed back to the CDSS for model retraining */
  @Column({ name: 'feedback_sent_to_cdss', default: false })
  feedbackSentToCdss: boolean = false;

  @Column({ name: 'feedback_sent_at', type: 'timestamptz', nullable: true })
  feedbackSentAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
