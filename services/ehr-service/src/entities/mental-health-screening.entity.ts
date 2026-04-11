import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('mental_health_screenings')
export class MentalHealthScreening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'screened_by', type: 'uuid' })
  screenedBy: string;

  @Column({ name: 'screened_at', type: 'timestamptz', default: () => 'now()' })
  screenedAt: Date;

  @Column({ type: 'text' })
  tool: string;

  @Column({ type: 'jsonb', default: {} })
  responses: Record<string, any>;

  @Column({ name: 'total_score', type: 'int', nullable: true })
  totalScore: number | null;

  @Column({ type: 'text', nullable: true })
  severity: string | null;

  @Column({ name: 'risk_level', type: 'text', nullable: true })
  riskLevel: string | null;

  @Column({ name: 'action_taken', type: 'text', nullable: true })
  actionTaken: string | null;

  @Column({ name: 'language_code', default: 'en' })
  languageCode: string;

  @Column({ name: 'referred', default: false })
  referred: boolean;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
