import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'triage_assessments' })
export class TriageAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint: string;

  @Column({ name: 'chief_complaint_snomed_code', type: 'varchar', length: 50, nullable: true })
  chiefComplaintSnomedCode?: string;

  @Column({ name: 'chief_complaint_snomed_term', type: 'text', nullable: true })
  chiefComplaintSnomedTerm?: string;

  @Column({ name: 'chief_complaint_snomed_module_id', type: 'varchar', length: 50, nullable: true })
  chiefComplaintSnomedModuleId?: string;

  @Column({ name: 'chief_complaint_snomed_definition_status', type: 'varchar', length: 50, nullable: true })
  chiefComplaintSnomedDefinitionStatus?: string;

  @Column({ type: 'text', nullable: true })
  onset?: string;

  @Column({ name: 'pain_score', type: 'int', nullable: true })
  painScore?: number;

  @Column({ type: 'text', nullable: true })
  allergies?: string;

  @Column({ type: 'text', nullable: true })
  medications?: string;

  @Column({ type: 'text', nullable: true })
  history?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ name: 'observations_snomed', type: 'jsonb', nullable: true, default: () => "'[]'::jsonb" })
  observationsSnomed?: any[];

  @Column({ type: 'varchar', length: 20 })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ name: 'severity_score', type: 'int', nullable: true })
  severityScore?: number;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}


