import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type DiabetesType = 'type1' | 'type2' | 'gestational' | 'lada' | 'mody' | 'secondary' | 'prediabetes' | 'other';
export type DiabetesRegistryStatus = 'active' | 'in_remission' | 'resolved' | 'deceased';

@Entity('diabetes_registry')
export class DiabetesRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'diabetes_type', type: 'varchar', length: 30 })
  diabetesType: DiabetesType;

  @Column({ name: 'diabetes_type_snomed_code', type: 'varchar', length: 50, nullable: true })
  diabetesTypeSnomedCode?: string;

  @Column({ name: 'diabetes_type_snomed_term', type: 'text', nullable: true })
  diabetesTypeSnomedTerm?: string;

  @Column({ name: 'diagnosis_date', type: 'date' })
  diagnosisDate: Date;

  @Column({ name: 'age_at_diagnosis', type: 'int', nullable: true })
  ageAtDiagnosis?: number;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: DiabetesRegistryStatus;

  @Column({ name: 'family_history', type: 'boolean', default: false })
  familyHistory: boolean;

  @Column({ name: 'primary_care_provider_id', type: 'uuid', nullable: true })
  primaryCareProviderId?: string;

  @Column({ name: 'endocrinologist_id', type: 'uuid', nullable: true })
  endocrinologistId?: string;

  @Column({ name: 'diabetes_educator_id', type: 'uuid', nullable: true })
  diabetesEducatorId?: string;

  @Column({ name: 'care_plan', type: 'text', nullable: true })
  carePlan?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




