import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('medication_reconciliation_ai_reviews')
@Index('idx_med_recon_ai_reviews_patient_created', ['patientId', 'createdAt'])
@Index('idx_med_recon_ai_reviews_status', ['reviewStatus', 'createdAt'])
export class MedicationReconciliationAiReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy: string | null;

  @Column({ name: 'review_status', type: 'varchar', length: 30, default: 'generated' })
  reviewStatus: string;

  @Column({ name: 'reported_medications', type: 'jsonb', default: () => "'[]'::jsonb" })
  reportedMedications: Array<Record<string, any>>;

  @Column({ name: 'current_medications', type: 'jsonb', default: () => "'[]'::jsonb" })
  currentMedications: Array<Record<string, any>>;

  @Column({ name: 'history_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  historySummary: Record<string, any>;

  @Column({ name: 'discrepancy_summary', type: 'jsonb', default: () => "'[]'::jsonb" })
  discrepancySummary: Array<Record<string, any>>;

  @Column({ name: 'duplicate_therapy_signals', type: 'jsonb', default: () => "'[]'::jsonb" })
  duplicateTherapySignals: Array<Record<string, any>>;

  @Column({ name: 'adherence_concerns', type: 'jsonb', default: () => "'[]'::jsonb" })
  adherenceConcerns: Array<Record<string, any>>;

  @Column({ name: 'safety_alerts', type: 'jsonb', default: () => "'{}'::jsonb" })
  safetyAlerts: Record<string, any>;

  @Column({ name: 'recommended_actions', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendedActions: Array<Record<string, any>>;

  @Column({ name: 'counseling_material_id', type: 'uuid', nullable: true })
  counselingMaterialId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
