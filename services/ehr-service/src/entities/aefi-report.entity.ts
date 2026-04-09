import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('aefi_reports')
export class AefiReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'immunization_record_id', nullable: true })
  immunizationRecordId: string;

  @Column({ name: 'event_type', length: 100 })
  eventType: string;

  @Column({ name: 'onset_date', type: 'date' })
  onsetDate: string;

  @Column({ length: 20 })
  severity: 'mild' | 'moderate' | 'severe' | 'fatal';

  @Column({ length: 50, nullable: true })
  outcome: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: false })
  hospitalized: boolean;

  @Column({ name: 'reported_to_moh', default: false })
  reportedToMoh: boolean;

  @Column({ name: 'moh_reference', length: 50, nullable: true })
  mohReference: string;

  @Column({ name: 'reported_by', nullable: true })
  reportedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
