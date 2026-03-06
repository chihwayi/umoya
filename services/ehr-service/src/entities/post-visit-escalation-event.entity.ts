import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_escalation_events')
export class PostVisitEscalationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'thread_id', type: 'uuid', nullable: true })
  threadId: string | null;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';

  @Index()
  @Column({ type: 'varchar', length: 20 })
  severity: 'low' | 'moderate' | 'high' | 'critical';

  @Index()
  @Column({ name: 'route_target', type: 'varchar', length: 20 })
  routeTarget: 'emergency' | 'doctor' | 'nurse';

  @Column({ name: 'trigger_type', type: 'varchar', length: 50, default: 'symptom_keyword' })
  triggerType: string;

  @Column({ name: 'trigger_terms', type: 'jsonb', default: () => "'[]'::jsonb" })
  triggerTerms: string[];

  @Column({ name: 'signal_text', type: 'text', nullable: true })
  signalText: string | null;

  @Column({ name: 'detected_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  detectedAt: Date;

  @Column({ name: 'sla_due_at', type: 'timestamp with time zone', nullable: true })
  slaDueAt: Date | null;

  @Column({ name: 'acknowledged_at', type: 'timestamp with time zone', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ name: 'workflow_key', type: 'varchar', length: 160, nullable: true })
  workflowKey: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
