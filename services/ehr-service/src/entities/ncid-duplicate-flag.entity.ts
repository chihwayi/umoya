import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ncid_duplicate_flags' })
@Index(['patientIdA'])
@Index(['patientIdB'])
@Index(['resolutionStatus'])
export class NcidDuplicateFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id_a', type: 'uuid' })
  patientIdA: string;

  @Column({ name: 'patient_id_b', type: 'uuid' })
  patientIdB: string;

  @Column({ name: 'match_score', type: 'decimal', precision: 4, scale: 3 })
  matchScore: number;

  @Column({ name: 'match_method' })
  matchMethod: string;

  @Column({ name: 'match_fields', type: 'jsonb', default: [] })
  matchFields: string[];

  @Column({ name: 'cdss_recommendation', nullable: true })
  cdssRecommendation: string | null;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  cdssConfidence: number | null;

  @Column({ name: 'cdss_reasoning', nullable: true })
  cdssReasoning: string | null;

  @Column({ name: 'resolution_status', default: 'pending' })
  resolutionStatus: string;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'merged_into_patient_id', type: 'uuid', nullable: true })
  mergedIntoPatientId: string | null;

  @Column({ name: 'resolution_notes', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  detectedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
