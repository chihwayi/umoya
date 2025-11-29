import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type ConditionType = 'diagnosis' | 'surgery' | 'procedure' | 'injury' | 'hospitalization' | 'other';
export type HistoryStatus = 'active' | 'resolved' | 'chronic' | 'history';

@Entity('patient_medical_history')
export class PatientMedicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'condition_type', type: 'varchar', length: 50 })
  conditionType: ConditionType;

  @Column({ name: 'condition_name', type: 'varchar', length: 255 })
  conditionName: string;

  @Column({ name: 'snomed_concept_id', type: 'varchar', length: 50, nullable: true })
  snomedConceptId?: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm?: string;

  @Column({ name: 'diagnosis_date', type: 'date', nullable: true })
  diagnosisDate?: Date;

  @Column({ name: 'resolved_date', type: 'date', nullable: true })
  resolvedDate?: Date;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: HistoryStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'treating_physician', type: 'varchar', length: 255, nullable: true })
  treatingPhysician?: string;

  @Column({ name: 'facility_name', type: 'varchar', length: 255, nullable: true })
  facilityName?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

