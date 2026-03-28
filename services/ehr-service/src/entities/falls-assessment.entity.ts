import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('falls_assessments')
export class FallsAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'timestamptz', default: () => 'now()' })
  assessmentDate: Date;

  @Column({ name: 'morse_score', type: 'int', nullable: true })
  morseScore: number | null;

  @Column({ name: 'fall_history_count', type: 'int', default: 0 })
  fallHistoryCount: number;

  @Column({ name: 'primary_diagnosis', type: 'text', nullable: true })
  primaryDiagnosis: string | null;

  @Column({ type: 'text', nullable: true })
  ambulation: string | null;

  @Column({ name: 'iv_line_present', type: 'boolean', default: false })
  ivLinePresent: boolean;

  @Column({ type: 'text', nullable: true })
  gait: string | null;

  @Column({ name: 'mental_status', type: 'text', nullable: true })
  mentalStatus: string | null;

  @Column({ type: 'jsonb', default: [] })
  medications: any[];

  @Column({ name: 'risk_category', type: 'text', nullable: true })
  riskCategory: string | null;

  @Column({ name: 'prevention_plan', type: 'text', nullable: true })
  preventionPlan: string | null;

  @Column({ name: 'tinnetti_gait', type: 'int', nullable: true })
  tinnettiGait: number | null;

  @Column({ name: 'tinnetti_balance', type: 'int', nullable: true })
  tinnettiBalance: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
