import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DiabetesRegistry } from './diabetes-registry.entity';
import { Patient } from './patient.entity';

export type DiabetesScreeningType = 'retinopathy' | 'neuropathy' | 'nephropathy' | 'cardiovascular' | 'foot_ulcer' | 'other';

@Entity('diabetes_complication_screening')
export class DiabetesComplicationScreening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diabetes_registry_id', type: 'uuid' })
  diabetesRegistryId: string;

  @ManyToOne(() => DiabetesRegistry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diabetes_registry_id' })
  registry: DiabetesRegistry;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'screening_type', type: 'varchar', length: 50 })
  screeningType: DiabetesScreeningType;

  @Column({ name: 'screening_date', type: 'date' })
  screeningDate: Date;

  @Column({ name: 'screening_result', type: 'text', nullable: true })
  screeningResult?: string;

  @Column({ name: 'screening_result_snomed_code', type: 'varchar', length: 50, nullable: true })
  screeningResultSnomedCode?: string;

  @Column({ name: 'screening_result_snomed_term', type: 'text', nullable: true })
  screeningResultSnomedTerm?: string;

  @Column({ name: 'severity_grade', type: 'varchar', length: 50, nullable: true })
  severityGrade?: string;

  @Column({ type: 'text', nullable: true })
  findings?: string;

  @Column({ name: 'treatment_recommended', type: 'boolean', default: false })
  treatmentRecommended: boolean;

  @Column({ name: 'treatment_plan', type: 'text', nullable: true })
  treatmentPlan?: string;

  @Column({ name: 'next_screening_due_date', type: 'date', nullable: true })
  nextScreeningDueDate?: Date;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy?: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




