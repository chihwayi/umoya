import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  code: string;

  @Column({ name: 'code_system', length: 50, default: 'SNOMED_CT' })
  codeSystem: string;

  @Column({ name: 'snomed_concept_id', nullable: true })
  snomedConceptId: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm: string;

  @Column({ name: 'snomed_module_id', nullable: true })
  snomedModuleId: string;

  @Column({ name: 'snomed_definition_status', nullable: true })
  snomedDefinitionStatus: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'resolved';

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: Date | null;

  @Column({ name: 'resolved_date', type: 'date', nullable: true })
  resolvedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


