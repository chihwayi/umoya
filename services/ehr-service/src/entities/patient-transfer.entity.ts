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
import { Admission } from './admission.entity';
import { Bed } from './bed.entity';

@Entity('patient_transfers')
export class PatientTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admission_id', type: 'uuid' })
  admissionId: string;

  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission: Admission;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'transfer_date', type: 'timestamptz' })
  transferDate: Date;

  @Column({ name: 'transfer_time', type: 'timestamptz' })
  transferTime: Date;

  @Column({ name: 'transfer_type', length: 50 })
  transferType: string;

  @Column({ name: 'from_bed_id', type: 'uuid', nullable: true })
  fromBedId: string;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'from_bed_id' })
  fromBed: Bed;

  @Column({ name: 'from_ward', length: 100, nullable: true })
  fromWard: string;

  @Column({ name: 'from_service', length: 100, nullable: true })
  fromService: string;

  @Column({ name: 'to_bed_id', type: 'uuid', nullable: true })
  toBedId: string;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'to_bed_id' })
  toBed: Bed;

  @Column({ name: 'to_ward', length: 100, nullable: true })
  toWard: string;

  @Column({ name: 'to_service', length: 100, nullable: true })
  toService: string;

  @Column({ name: 'to_facility', length: 255, nullable: true })
  toFacility: string;

  @Column({ name: 'transfer_reason', type: 'text' })
  transferReason: string;

  @Column({ name: 'transfer_reason_snomed', length: 20, nullable: true })
  transferReasonSnomed: string;

  @Column({ name: 'transfer_reason_term', type: 'text', nullable: true })
  transferReasonTerm: string;

  @Column({ name: 'clinical_reason', type: 'text', nullable: true })
  clinicalReason: string;

  @Column({ name: 'clinical_reason_snomed', length: 20, nullable: true })
  clinicalReasonSnomed: string;

  @Column({ name: 'accepting_provider', type: 'uuid', nullable: true })
  acceptingProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accepting_provider' })
  acceptingProviderUser: User;

  @Column({ name: 'transferring_provider', type: 'uuid', nullable: true })
  transferringProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'transferring_provider' })
  transferringProviderUser: User;

  @Column({ name: 'patient_condition', length: 100, nullable: true })
  patientCondition: string;

  @Column({ name: 'mode_of_transport', length: 100, nullable: true })
  modeOfTransport: string;

  @Column({ name: 'equipment_needed', type: 'text', nullable: true })
  equipmentNeeded: string;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @Column({ name: 'transfer_accepted', default: true })
  transferAccepted: boolean;

  @Column({ name: 'transfer_completed', default: false })
  transferCompleted: boolean;

  @Column({ name: 'transfer_completed_time', type: 'timestamptz', nullable: true })
  transferCompletedTime: Date;

  @Column({ default: false })
  cancelled: boolean;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

