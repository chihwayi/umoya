import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_transcript_segments')
export class PostVisitTranscriptSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'segment_order', type: 'integer' })
  segmentOrder: number;

  @Column({ name: 'start_second', type: 'double precision' })
  startSecond: number;

  @Column({ name: 'end_second', type: 'double precision' })
  endSecond: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
