import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('one_health_reports')
export class OneHealthReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'animal_exposure_id', type: 'uuid', nullable: true })
  animalExposureId: string | null;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ name: 'suspected_zoonosis', type: 'text' })
  suspectedZoonosis: string;

  @Column({ name: 'icd11_code', type: 'text', nullable: true })
  icd11Code: string | null;

  @Column({ name: 'report_date', type: 'date' })
  reportDate: string;

  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary: string | null;

  @Column({ name: 'lab_evidence', type: 'jsonb', default: {} })
  labEvidence: Record<string, any>;

  @Column({ name: 'submitted_to_vet_authority', type: 'boolean', default: false })
  submittedToVetAuthority: boolean;

  @Column({ name: 'vet_authority_reference', type: 'text', nullable: true })
  vetAuthorityReference: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
