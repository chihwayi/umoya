import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_extracted_entities')
export class PostVisitExtractedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'entity_type', type: 'varchar', length: 60 })
  entityType: string;

  @Column({ name: 'entity_value', type: 'text' })
  entityValue: string;

  @Column({ name: 'normalized_value', type: 'jsonb', default: () => "'{}'::jsonb" })
  normalizedValue: Record<string, any>;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @Column({ name: 'source_start_second', type: 'double precision', nullable: true })
  sourceStartSecond: number | null;

  @Column({ name: 'source_end_second', type: 'double precision', nullable: true })
  sourceEndSecond: number | null;

  @Column({ name: 'source_origin', type: 'varchar', length: 30, default: 'transcript' })
  sourceOrigin: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
