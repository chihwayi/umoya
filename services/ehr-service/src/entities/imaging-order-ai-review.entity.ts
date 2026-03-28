import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('imaging_order_ai_reviews')
@Index('idx_imaging_order_ai_reviews_order_created', ['imagingOrderId', 'createdAt'])
@Index('idx_imaging_order_ai_reviews_patient_status', ['patientId', 'appropriatenessStatus'])
export class ImagingOrderAiReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'imaging_order_id', type: 'uuid' })
  imagingOrderId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'study_type_id', type: 'uuid' })
  studyTypeId: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'review_status', type: 'varchar', length: 30, default: 'generated' })
  reviewStatus: string;

  @Column({ name: 'appropriateness_status', type: 'varchar', length: 40, default: 'needs_context' })
  appropriatenessStatus: string;

  @Column({ name: 'protocol_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  protocolSummary: Record<string, any>;

  @Column({ name: 'supporting_signals', type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingSignals: Array<Record<string, any>>;

  @Column({ name: 'blocking_issues', type: 'jsonb', default: () => "'[]'::jsonb" })
  blockingIssues: Array<Record<string, any>>;

  @Column({ name: 'recommended_alternatives', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendedAlternatives: Array<Record<string, any>>;

  @Column({ name: 'guideline_citations', type: 'jsonb', default: () => "'[]'::jsonb" })
  guidelineCitations: Array<Record<string, any>>;

  @Column({ type: 'text' })
  rationale: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
