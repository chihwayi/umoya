import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('order_appropriateness_reviews')
@Index('idx_order_appropriateness_reviews_session', ['encounterCopilotSessionId', 'createdAt'])
@Index('idx_order_appropriateness_reviews_patient_status', ['patientId', 'appropriatenessStatus'])
export class OrderAppropriatenessReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'encounter_copilot_session_id', type: 'uuid' })
  encounterCopilotSessionId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'proposed_order_type', type: 'varchar', length: 50, nullable: true })
  proposedOrderType: string | null;

  @Column({ name: 'proposed_order_name', type: 'varchar', length: 255 })
  proposedOrderName: string;

  @Column({ name: 'appropriateness_status', type: 'varchar', length: 40, default: 'needs_context' })
  appropriatenessStatus: string;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceScore: number | null;

  @Column({ name: 'proposed_order', type: 'jsonb', default: () => "'{}'::jsonb" })
  proposedOrder: Record<string, any>;

  @Column({ name: 'supporting_signals', type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingSignals: Array<Record<string, any>>;

  @Column({ name: 'blocking_issues', type: 'jsonb', default: () => "'[]'::jsonb" })
  blockingIssues: Array<Record<string, any>>;

  @Column({ name: 'recommended_alternatives', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendedAlternatives: Array<Record<string, any>>;

  @Column({ type: 'text' })
  rationale: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
