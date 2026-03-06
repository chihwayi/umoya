import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_rule_citations')
export class PostVisitRuleCitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'artifact_type', type: 'varchar', length: 50, default: 'recommendation_bundle' })
  artifactType: string;

  @Column({ name: 'recommendation_id', type: 'varchar', length: 120, nullable: true })
  recommendationId: string | null;

  @Index()
  @Column({ name: 'rule_id', type: 'varchar', length: 120 })
  ruleId: string;

  @Index()
  @Column({ name: 'guideline_id', type: 'varchar', length: 120 })
  guidelineId: string;

  @Column({ name: 'citation_label', type: 'varchar', length: 255 })
  citationLabel: string;

  @Column({ name: 'citation_source', type: 'varchar', length: 255 })
  citationSource: string;

  @Column({ name: 'citation_url', type: 'text', nullable: true })
  citationUrl: string | null;

  @Column({ name: 'evidence_excerpt', type: 'text', nullable: true })
  evidenceExcerpt: string | null;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
