import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cognitive_assessments')
export class CognitiveAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'timestamptz', default: () => 'now()' })
  assessmentDate: Date;

  @Column({ name: 'mmse_score', type: 'int', nullable: true })
  mmseScore: number | null;

  @Column({ name: 'moca_score', type: 'int', nullable: true })
  mocaScore: number | null;

  @Column({ name: 'cdt_score', type: 'int', nullable: true })
  cdtScore: number | null;

  @Column({ name: 'domain_scores', type: 'jsonb', default: {} })
  domainScores: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  interpretation: string | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;
  @Column({ name: 'max_score', type: 'int', nullable: true })
  maxScore?: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  severity?: string;

  @Column({ nullable: true })
  tool?: string;

  @Column({ name: 'total_score', type: 'int', nullable: true })
  totalScore?: number;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
