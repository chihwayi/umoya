import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_action_executions')
export class PostVisitActionExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'recommendation_id', type: 'varchar', length: 120 })
  recommendationId: string;

  @Column({ name: 'action_key', type: 'varchar', length: 160 })
  actionKey: string;

  @Column({ name: 'action_type', type: 'varchar', length: 60 })
  actionType: string;

  @Column({ type: 'varchar', length: 20, default: 'executed' })
  status: 'executed' | 'failed' | 'skipped';

  @Column({ name: 'execution_note', type: 'text', nullable: true })
  executionNote: string | null;

  @Column({ name: 'result_resource_type', type: 'varchar', length: 80, nullable: true })
  resultResourceType: string | null;

  @Column({ name: 'result_resource_id', type: 'varchar', length: 120, nullable: true })
  resultResourceId: string | null;

  @Column({ name: 'result_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  resultPayload: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'executed_by', type: 'uuid', nullable: true })
  executedBy: string | null;

  @Column({ name: 'executed_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  executedAt: Date;

  @Column({ type: 'varchar', length: 80, default: 'post_visit_execute' })
  source: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
