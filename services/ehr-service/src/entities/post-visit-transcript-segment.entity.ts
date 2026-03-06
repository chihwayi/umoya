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

  @Column({ name: 'speaker_label', type: 'varchar', length: 60, nullable: true })
  speakerLabel: string | null;

  @Column({ name: 'speaker_role', type: 'varchar', length: 20, default: 'unknown' })
  speakerRole: 'doctor' | 'patient' | 'unknown';

  @Column({ name: 'diarization_confidence', type: 'double precision', nullable: true })
  diarizationConfidence: number | null;

  @Column({ name: 'speaker_assignment_status', type: 'varchar', length: 20, default: 'unresolved' })
  speakerAssignmentStatus: 'auto' | 'confirmed' | 'reassigned' | 'unresolved';

  @Column({ name: 'needs_review', type: 'boolean', default: false })
  needsReview: boolean;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
