import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('patient_identity_matches')
export class PatientIdentityMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_type', type: 'varchar', length: 40, default: 'registration_intake' })
  sourceType: string;

  @Column({ name: 'source_reference', type: 'varchar', length: 100, nullable: true })
  sourceReference?: string | null;

  @Column({ name: 'subject_patient_id', type: 'uuid', nullable: true })
  subjectPatientId?: string | null;

  @Column({ name: 'candidate_patient_id', type: 'uuid' })
  candidatePatientId: string;

  @Column({ name: 'match_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  matchScore: number;

  @Column({ name: 'match_reasons', type: 'jsonb', default: () => "'[]'::jsonb" })
  matchReasons: string[];

  @Column({ name: 'match_signals', type: 'jsonb', default: () => "'{}'::jsonb" })
  matchSignals: Record<string, any>;

  @Column({ name: 'match_status', type: 'varchar', length: 30, default: 'suggested' })
  matchStatus: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
