import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('immunizations')
export class Immunization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'immunization_number', length: 50, unique: true })
  immunizationNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'vaccine_code', length: 20 })
  vaccineCode: string;

  @Column({ name: 'vaccine_name', length: 255 })
  vaccineName: string;

  @Column({ length: 100, nullable: true })
  manufacturer: string;

  @Column({ name: 'lot_number', length: 50, nullable: true })
  lotNumber: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ name: 'administration_date', type: 'date' })
  administrationDate: Date;

  @Column({ name: 'administration_time', type: 'time', nullable: true })
  administrationTime: string;

  @Column({ name: 'dose_number', nullable: true })
  doseNumber: number;

  @Column({ name: 'dose_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true })
  doseQuantity: number;

  @Column({ name: 'dose_unit', length: 20, nullable: true })
  doseUnit: string;

  @Column({ length: 50, nullable: true })
  route: string;

  @Column({ length: 100, nullable: true })
  site: string;

  @Column({ name: 'administered_by', type: 'uuid', nullable: true })
  administeredBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'administered_by' })
  administeredByUser: User;

  @Column({ name: 'ordering_provider', type: 'uuid', nullable: true })
  orderingProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ordering_provider' })
  orderingProviderUser: User;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({ name: 'vis_date', type: 'date', nullable: true })
  visDate: Date;

  @Column({ name: 'vis_presented', default: false })
  visPresented: boolean;

  @Column({ name: 'funding_source', length: 100, nullable: true })
  fundingSource: string;

  @Column({ name: 'completion_status', length: 50, default: 'completed' })
  completionStatus: string;

  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'reaction_observed', default: false })
  reactionObserved: boolean;

  @Column({ name: 'reaction_details', type: 'text', nullable: true })
  reactionDetails: string;

  @Column({ name: 'reported_to_vaers', default: false })
  reportedToVaers: boolean;

  @Column({ name: 'vaers_report_id', length: 50, nullable: true })
  vaersReportId: string;

  @Column({ name: 'registry_submitted', default: false })
  registrySubmitted: boolean;

  @Column({ name: 'registry_submission_date', type: 'timestamptz', nullable: true })
  registrySubmissionDate: Date;

  @Column({ name: 'registry_response', type: 'text', nullable: true })
  registryResponse: string;

  @Column({ default: false })
  historical: boolean;

  @Column({ name: 'historical_source', length: 255, nullable: true })
  historicalSource: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

