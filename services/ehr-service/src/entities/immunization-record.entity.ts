import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('immunization_records')
export class ImmunizationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'epi_schedule_id', nullable: true })
  epiScheduleId: string;

  @Column({ name: 'vaccine_name', length: 100 })
  vaccineName: string;

  @Column({ name: 'dose_number' })
  doseNumber: number;

  @Column({ name: 'lot_number', length: 50, nullable: true })
  lotNumber: string;

  @Column({ length: 100, nullable: true })
  manufacturer: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string;

  @Column({ name: 'administered_at', type: 'timestamptz' })
  administeredAt: Date;

  @Column({ name: 'administered_by', nullable: true })
  administeredBy: string;

  @Column({ length: 50, nullable: true })
  site: string;

  @Column({ length: 20, nullable: true })
  route: string;

  @Column({ name: 'dose_ml', type: 'numeric', precision: 5, scale: 2, nullable: true })
  doseMl: number;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;

  @Column({ name: 'dhis2_event_uid', length: 50, nullable: true })
  dhis2EventUid: string;

  @Column({ length: 20, default: 'given' })
  status: 'given' | 'missed' | 'contraindicated';

  @Column({ name: 'contraindication_reason', type: 'text', nullable: true })
  contraindicationReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
