import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('radiology_discrepancy_reviews')
@Index('idx_radiology_discrepancy_reviews_report_created', ['imagingReportId', 'createdAt'])
@Index('idx_radiology_discrepancy_reviews_study_status', ['imagingStudyId', 'discrepancyStatus'])
export class RadiologyDiscrepancyReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'imaging_study_id', type: 'uuid' })
  imagingStudyId: string;

  @Column({ name: 'imaging_order_id', type: 'uuid' })
  imagingOrderId: string;

  @Column({ name: 'imaging_report_id', type: 'uuid' })
  imagingReportId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'ai_finding_id', type: 'uuid', nullable: true })
  aiFindingId: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'review_status', type: 'varchar', length: 30, default: 'generated' })
  reviewStatus: string;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'discrepancy_status', type: 'varchar', length: 40, default: 'no_ai_comparison' })
  discrepancyStatus: string;

  @Column({ name: 'ai_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  aiSummary: Record<string, any>;

  @Column({ name: 'report_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  reportSummary: Record<string, any>;

  @Column({ name: 'discrepancy_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  discrepancySummary: Record<string, any>;

  @Column({ type: 'text' })
  rationale: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
