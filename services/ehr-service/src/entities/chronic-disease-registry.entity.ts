import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('chronic_disease_registry')
export class ChronicDiseaseRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'condition_code', length: 20 })
  conditionCode: string;

  @Column({ name: 'condition_name', length: 255 })
  conditionName: string;

  @Column({ name: 'condition_type', length: 50 })
  conditionType: string;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: Date | null;

  @Column({ length: 20, default: 'active' })
  status: string;

  @Column({ name: 'risk_level', length: 20, default: 'moderate' })
  riskLevel: string;

  @Column({ name: 'last_review_date', type: 'date', nullable: true })
  lastReviewDate: Date | null;

  @Column({ name: 'next_review_date', type: 'date', nullable: true })
  nextReviewDate: Date | null;

  @Column({ name: 'care_team', type: 'jsonb', default: () => "'[]'::jsonb" })
  careTeam: any[];

  @Column({ name: 'management_plan', type: 'text', nullable: true })
  managementPlan: string | null;

  @Column({ name: 'target_metrics', type: 'jsonb', default: () => "'{}'::jsonb" })
  targetMetrics: Record<string, any>;

  @Column({ name: 'current_metrics', type: 'jsonb', default: () => "'{}'::jsonb" })
  currentMetrics: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
