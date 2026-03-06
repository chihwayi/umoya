import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_review_actions')
export class PostVisitReviewAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'artifact_id', type: 'uuid', nullable: true })
  artifactId: string | null;

  @Index()
  @Column({ name: 'artifact_type', type: 'varchar', length: 50 })
  artifactType: string;

  @Column({ type: 'varchar', length: 20 })
  action: 'accept' | 'edit' | 'reject';

  @Column({ name: 'review_reason', type: 'text', nullable: true })
  reviewReason: string | null;

  @Column({ name: 'review_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  reviewMetadata: Record<string, any>;

  @Column({ name: 'before_content', type: 'jsonb', default: () => "'{}'::jsonb" })
  beforeContent: Record<string, any>;

  @Column({ name: 'after_content', type: 'jsonb', default: () => "'{}'::jsonb" })
  afterContent: Record<string, any>;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'varchar', length: 80, default: 'post_visit_review' })
  source: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
