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

  @Column({ name: 'relevance_score', type: 'double precision', nullable: true })
  relevanceScore: number | null;

  @Column({ name: 'citation_year', type: 'integer', nullable: true })
  citationYear: number | null;

  @Column({ name: 'is_superseded', type: 'boolean', default: false })
  isSuperseded: boolean;

  @Column({ name: 'superseded_by_guideline_id', type: 'varchar', length: 120, nullable: true })
  supersededByGuidelineId: string | null;

  @Column({ name: 'doctor_acknowledged_superseded', type: 'boolean', default: false })
  doctorAcknowledgedSuperseded: boolean;

  @Column({ name: 'superseded_acknowledged_by', type: 'uuid', nullable: true })
  supersededAcknowledgedBy: string | null;

  @Column({ name: 'superseded_acknowledged_at', type: 'timestamp with time zone', nullable: true })
  supersededAcknowledgedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
