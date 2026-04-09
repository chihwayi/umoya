import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('outbreak_cases')
export class OutbreakCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'notifiable_disease_id', type: 'uuid', nullable: true })
  notifiableDiseaseId: string | null;

  @Column({ name: 'diagnosis_date', type: 'date' })
  diagnosisDate: string;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: string | null;

  @Column({ name: 'status', default: 'suspected' })
  status: string; // suspected | probable | confirmed | discarded

  @Column({ name: 'exposure_location', type: 'text', nullable: true })
  exposureLocation: string | null;

  @Column({ name: 'exposure_date', type: 'date', nullable: true })
  exposureDate: string | null;

  @Column({ name: 'case_classification', length: 50, nullable: true })
  caseClassification: string | null;

  @Column({ name: 'lab_result', length: 50, nullable: true })
  labResult: string | null;

  @Column({ name: 'outcome', length: 20, nullable: true })
  outcome: string | null;

  @Column({ name: 'reported_to_moh', default: false })
  reportedToMoh: boolean;

  @Column({ name: 'moh_reference', length: 50, nullable: true })
  mohReference: string | null;

  @Column({ name: 'sormas_case_uuid', length: 50, nullable: true })
  sormasCaseUuid: string | null;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
