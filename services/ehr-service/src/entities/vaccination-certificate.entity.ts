import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('vaccination_certificates')
export class VaccinationCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Index({ unique: true })
  @Column({ name: 'certificate_number', length: 50 })
  certificateNumber: string;

  @Column({
    name: 'certificate_type',
    length: 30,
    default: 'yellow_card',
  })
  certificateType: 'yellow_card' | 'covid_card' | 'general';

  @Column({ name: 'issued_date', type: 'date' })
  issuedDate: Date;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @Column({ name: 'issuing_center', length: 255, nullable: true })
  issuingCenter: string | null;

  @Column({ name: 'immunization_ids', type: 'jsonb', default: () => `'[]'::jsonb` })
  immunizationIds: string[];

  @Column({ name: 'pdf_storage_key', length: 500, nullable: true })
  pdfStorageKey: string | null;

  @Column({ name: 'is_valid', default: true })
  isValid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

