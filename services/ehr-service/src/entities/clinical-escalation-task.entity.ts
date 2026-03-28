import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('clinical_escalation_tasks')
@Index('idx_clinical_escalation_tasks_patient_status', ['patientId', 'status'])
@Index('idx_clinical_escalation_tasks_ews', ['earlyWarningScoreId'])
@Index('idx_clinical_escalation_tasks_due_at', ['dueAt'])
export class ClinicalEscalationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'early_warning_score_id', type: 'uuid', nullable: true })
  earlyWarningScoreId: string | null;

  @Column({ name: 'nurse_task_id', type: 'uuid', nullable: true })
  nurseTaskId: string | null;

  @Column({ name: 'source_module', type: 'varchar', length: 50, default: 'early_warning' })
  sourceModule: string;

  @Column({ name: 'source_reference_id', type: 'uuid', nullable: true })
  sourceReferenceId: string | null;

  @Column({ name: 'escalation_type', type: 'varchar', length: 50 })
  escalationType: string;

  @Column({ type: 'varchar', length: 20, default: 'high' })
  severity: string;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
