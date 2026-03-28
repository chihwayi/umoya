import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patient_followup_orchestrations')
@Index('idx_patient_followup_orchestrations_patient_status', ['patientId', 'status', 'dueAt'])
@Index('idx_patient_followup_orchestrations_session_status', ['patientAiSessionId', 'status'])
export class PatientFollowupOrchestration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'patient_ai_session_id', type: 'uuid', nullable: true })
  patientAiSessionId: string | null;

  @Column({ name: 'trigger_type', type: 'varchar', length: 50 })
  triggerType: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 20, default: 'routine' })
  riskLevel: string;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'reminder_state', type: 'varchar', length: 30, default: 'pending' })
  reminderState: string;

  @Column({ name: 'next_action', type: 'text' })
  nextAction: string;

  @Column({ name: 'unresolved_question', type: 'text', nullable: true })
  unresolvedQuestion: string | null;

  @Column({ name: 'nonadherence_flag', type: 'boolean', default: false })
  nonadherenceFlag: boolean;

  @Column({ name: 'missed_followup_flag', type: 'boolean', default: false })
  missedFollowupFlag: boolean;

  @Column({ name: 'route_back_target', type: 'varchar', length: 30, nullable: true })
  routeBackTarget: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'last_touched_at', type: 'timestamptz', nullable: true })
  lastTouchedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
