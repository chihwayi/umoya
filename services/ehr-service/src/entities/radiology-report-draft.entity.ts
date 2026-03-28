import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('radiology_report_drafts')
@Index('idx_radiology_report_drafts_study_created', ['imagingStudyId', 'createdAt'])
@Index('idx_radiology_report_drafts_report_status', ['linkedReportId', 'draftStatus'])
export class RadiologyReportDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'imaging_study_id', type: 'uuid' })
  imagingStudyId: string;

  @Column({ name: 'imaging_order_id', type: 'uuid' })
  imagingOrderId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'ai_finding_id', type: 'uuid', nullable: true })
  aiFindingId: string | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy: string | null;

  @Column({ name: 'draft_status', type: 'varchar', length: 30, default: 'generated' })
  draftStatus: string;

  @Column({ name: 'draft_findings', type: 'text' })
  draftFindings: string;

  @Column({ name: 'draft_impression', type: 'text' })
  draftImpression: string;

  @Column({ name: 'draft_recommendations', type: 'text', nullable: true })
  draftRecommendations: string | null;

  @Column({ name: 'structured_draft', type: 'jsonb', default: () => "'{}'::jsonb" })
  structuredDraft: Record<string, any>;

  @Column({ name: 'supporting_evidence', type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingEvidence: Array<Record<string, any>>;

  @Column({ name: 'guideline_citations', type: 'jsonb', default: () => "'[]'::jsonb" })
  guidelineCitations: Array<Record<string, any>>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @Column({ name: 'linked_report_id', type: 'uuid', nullable: true })
  linkedReportId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
