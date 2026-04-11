import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('mental_health_care_plans')
export class MentalHealthCarePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'diagnosis_icd10', length: 10, nullable: true })
  diagnosisIcd10: string | null;

  @Column({ name: 'diagnosis_name', length: 100, nullable: true })
  diagnosisName: string | null;

  @Column({ name: 'care_level', length: 20, nullable: true })
  careLevel: string | null;

  @Column({ name: 'assigned_chw_id', type: 'uuid', nullable: true })
  assignedChwId: string | null;

  @Column({ name: 'assigned_provider', type: 'uuid', nullable: true })
  assignedProvider: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  goals: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  interventions: string[] | null;

  @Column({ length: 100, nullable: true })
  medication: string | null;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: string | null;

  @Column({ length: 20, default: 'active' })
  status: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
