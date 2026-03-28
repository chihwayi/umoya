import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('result_followup_tasks')
@Index('idx_result_followup_tasks_session_status', ['encounterCopilotSessionId', 'status', 'createdAt'])
@Index('idx_result_followup_tasks_patient_priority', ['patientId', 'priority', 'dueAt'])
@Index('idx_result_followup_tasks_source', ['sourceType', 'sourceReferenceId'])
export class ResultFollowupTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'encounter_copilot_session_id', type: 'uuid' })
  encounterCopilotSessionId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType: string;

  @Column({ name: 'source_reference_id', type: 'uuid', nullable: true })
  sourceReferenceId: string | null;

  @Column({ name: 'source_status', type: 'varchar', length: 30, nullable: true })
  sourceStatus: string | null;

  @Column({ name: 'task_type', type: 'varchar', length: 50 })
  taskType: string;

  @Column({ name: 'task_title', type: 'varchar', length: 255 })
  taskTitle: string;

  @Column({ name: 'task_summary', type: 'text' })
  taskSummary: string;

  @Column({ type: 'varchar', length: 20, default: 'high' })
  priority: string;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
