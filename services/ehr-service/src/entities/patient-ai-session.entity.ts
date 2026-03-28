import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patient_ai_sessions')
@Index('idx_patient_ai_sessions_patient_created', ['patientId', 'createdAt'])
@Index('idx_patient_ai_sessions_type_status', ['sessionType', 'status'])
@Index('idx_patient_ai_sessions_source_session', ['sourceSessionId'])
export class PatientAiSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'session_type', type: 'varchar', length: 40 })
  sessionType: string;

  @Column({ name: 'source_session_id', type: 'varchar', length: 100, nullable: true })
  sourceSessionId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'latest_message', type: 'text', nullable: true })
  latestMessage: string | null;

  @Column({ name: 'latest_reply', type: 'text', nullable: true })
  latestReply: string | null;

  @Column({ name: 'latest_intent', type: 'varchar', length: 80, nullable: true })
  latestIntent: string | null;

  @Column({ name: 'triage_level', type: 'varchar', length: 30, nullable: true })
  triageLevel: string | null;

  @Column({ type: 'varchar', length: 20, default: 'routine' })
  urgency: string;

  @Column({ name: 'guidance_summary', type: 'text', nullable: true })
  guidanceSummary: string | null;

  @Column({ name: 'requires_clinician_follow_up', type: 'boolean', default: false })
  requiresClinicianFollowUp: boolean;

  @Column({ name: 'urgent_signal', type: 'boolean', default: false })
  urgentSignal: boolean;

  @Column({ type: 'boolean', default: false })
  abstained: boolean;

  @Column({ name: 'abstain_reason', type: 'text', nullable: true })
  abstainReason: string | null;

  @Column({ name: 'citations', type: 'jsonb', default: () => "'[]'::jsonb" })
  citations: Array<Record<string, any>>;

  @Column({ name: 'provenance', type: 'jsonb', default: () => "'{}'::jsonb" })
  provenance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
