import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_companion_messages')
export class PostVisitCompanionMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'sender_type', type: 'varchar', length: 20 })
  senderType: 'patient' | 'clinician' | 'system';

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ name: 'message_type', type: 'varchar', length: 30, default: 'question' })
  messageType: 'question' | 'answer' | 'summary' | 'checklist' | 'alert' | 'system';

  @Column({ name: 'message_text', type: 'text' })
  messageText: string;

  @Column({ name: 'grounded_context', type: 'jsonb', default: () => "'{}'::jsonb" })
  groundedContext: Record<string, any>;

  @Column({ name: 'escalation_detected', type: 'boolean', default: false })
  escalationDetected: boolean;

  @Column({ name: 'escalation_event_id', type: 'uuid', nullable: true })
  escalationEventId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
