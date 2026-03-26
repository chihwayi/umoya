import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('incidental_finding_followups')
@Index('idx_incidental_followups_report_status', ['imagingReportId', 'status', 'createdAt'])
@Index('idx_incidental_followups_patient_due', ['patientId', 'status', 'dueAt'])
export class IncidentalFindingFollowup {
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

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'followup_type', type: 'varchar', length: 50, default: 'incidental_finding_followup' })
  followupType: string;

  @Column({ type: 'varchar', length: 20, default: 'moderate' })
  severity: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
