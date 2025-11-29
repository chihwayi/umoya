import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type Relationship = 'mother' | 'father' | 'sibling' | 'grandmother' | 'grandfather' | 'aunt' | 'uncle' | 'cousin' | 'other';

@Entity('patient_family_history')
export class PatientFamilyHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 50 })
  relationship: Relationship;

  @Column({ name: 'relative_name', type: 'varchar', length: 255, nullable: true })
  relativeName?: string;

  @Column({ name: 'condition_name', type: 'varchar', length: 255 })
  conditionName: string;

  @Column({ name: 'snomed_concept_id', type: 'varchar', length: 50, nullable: true })
  snomedConceptId?: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm?: string;

  @Column({ name: 'age_at_onset', type: 'integer', nullable: true })
  ageAtOnset?: number;

  @Column({ name: 'age_at_death', type: 'integer', nullable: true })
  ageAtDeath?: number;

  @Column({ name: 'cause_of_death', type: 'varchar', length: 255, nullable: true })
  causeOfDeath?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

