import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patient_ai_escalations')
@Index('idx_patient_ai_escalations_patient_status', ['patientId', 'status', 'createdAt'])
@Index('idx_patient_ai_escalations_session_status', ['patientAiSessionId', 'status'])
export class PatientAiEscalation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'patient_ai_session_id', type: 'uuid', nullable: true })
  patientAiSessionId: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 40 })
  sourceType: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ name: 'route_target', type: 'varchar', length: 30 })
  routeTarget: string;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'trigger_summary', type: 'text' })
  triggerSummary: string;

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'provenance', type: 'jsonb', default: () => "'{}'::jsonb" })
  provenance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
