import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('htn_register')
export class HtnRegister {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'enrolled_by', type: 'uuid' })
  enrolledBy: string;

  @Column({ name: 'enrolled_at', type: 'date' })
  enrolledAt: string;

  /** Stage 1 | Stage 2 | Hypertensive Crisis */
  @Column({ name: 'htn_stage', length: 30, nullable: true })
  htnStage: string | null;

  /** WHO PEN CVD risk tier: low | moderate | high | very_high */
  @Column({ name: 'cvd_risk_tier', length: 20, nullable: true })
  cvdRiskTier: string | null;

  /** Estimated 10-year CVD risk % */
  @Column({ name: 'cvd_risk_pct', type: 'numeric', precision: 5, scale: 1, nullable: true })
  cvdRiskPct: number | null;

  @Column({ name: 'has_diabetes', type: 'boolean', default: false })
  hasDiabetes: boolean;

  @Column({ name: 'has_ckd', type: 'boolean', default: false })
  hasCkd: boolean;

  @Column({ name: 'has_heart_failure', type: 'boolean', default: false })
  hasHeartFailure: boolean;

  @Column({ name: 'has_post_mi', type: 'boolean', default: false })
  hasPostMi: boolean;

  @Column({ name: 'is_pregnant', type: 'boolean', default: false })
  isPregnant: boolean;

  @Column({ name: 'is_smoker', type: 'boolean', default: false })
  isSmoker: boolean;

  /** Current WHO PEN step: 1 | 2 | 3 | 4 */
  @Column({ name: 'current_step', type: 'int', default: 1 })
  currentStep: number;

  /** Status: active | controlled | lost_to_followup | transferred | deceased */
  @Column({ length: 30, default: 'active' })
  status: string;

  @Column({ name: 'next_review_date', type: 'date', nullable: true })
  nextReviewDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
