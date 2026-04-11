import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('ncd_treatment_reviews')
export class NcdTreatmentReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'htn_register_id', type: 'uuid', nullable: true })
  htnRegisterId: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid' })
  reviewedBy: string;

  @Column({ name: 'reviewed_at', type: 'date' })
  reviewedAt: string;

  /** WHO PEN step at time of review */
  @Column({ name: 'pen_step', type: 'int' })
  penStep: number;

  /** BP at review (systolic) */
  @Column({ name: 'sbp_at_review', type: 'int', nullable: true })
  sbpAtReview: number | null;

  @Column({ name: 'dbp_at_review', type: 'int', nullable: true })
  dbpAtReview: number | null;

  /** Medications prescribed at this review (free-text or JSON array stored as text) */
  @Column({ name: 'medications', type: 'text', nullable: true })
  medications: string | null;

  /** step_up | step_down | maintain | add_statin | add_aspirin | referral | lifestyle_only */
  @Column({ name: 'action_taken', length: 30, nullable: true })
  actionTaken: string | null;

  /** Referral reason if action_taken = referral */
  @Column({ name: 'referral_reason', type: 'text', nullable: true })
  referralReason: string | null;

  /** Adherence: good | partial | poor | unknown */
  @Column({ length: 15, default: 'unknown' })
  adherence: string;

  /** Side effects reported */
  @Column({ name: 'side_effects', type: 'text', nullable: true })
  sideEffects: string | null;

  @Column({ name: 'next_review_date', type: 'date', nullable: true })
  nextReviewDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
