import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_draft_artifacts')
export class PostVisitDraftArtifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'artifact_type', type: 'varchar', length: 50 })
  artifactType: string;

  @Column({ name: 'artifact_status', type: 'varchar', length: 20, default: 'draft' })
  artifactStatus: 'draft' | 'reviewed' | 'published';

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  content: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  citations: Array<Record<string, any>>;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @Column({ name: 'generated_by', type: 'varchar', length: 80, default: 'post_visit_pipeline' })
  generatedBy: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
