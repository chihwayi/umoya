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

@Entity('beds')
export class Bed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bed_number', length: 50 })
  bedNumber: string;

  @Column({ name: 'room_number', length: 50 })
  roomNumber: string;

  @Column({ name: 'ward_name', length: 100 })
  wardName: string;

  @Column({ length: 50, nullable: true })
  floor: string;

  @Column({ length: 100, nullable: true })
  building: string;

  @Column({ name: 'bed_type', length: 50 })
  bedType: string;

  @Column({ length: 100, nullable: true })
  specialty: string;

  @Column({ length: 50, default: 'available' })
  status: string;

  @Column({ name: 'current_patient_id', type: 'uuid', nullable: true })
  currentPatientId: string;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'current_patient_id' })
  currentPatient: Patient;

  @Column({ name: 'current_admission_id', type: 'uuid', nullable: true })
  currentAdmissionId: string;

  @Column({ name: 'occupied_since', type: 'timestamptz', nullable: true })
  occupiedSince: Date;

  @Column({ name: 'expected_discharge', type: 'timestamptz', nullable: true })
  expectedDischarge: Date;

  @Column({ name: 'has_equipment', type: 'jsonb', default: '[]' })
  hasEquipment: string[];

  @Column({ type: 'jsonb', default: '[]' })
  features: string[];

  @Column({ name: 'is_isolation_capable', default: false })
  isIsolationCapable: boolean;

  @Column({ name: 'is_negative_pressure', default: false })
  isNegativePressure: boolean;

  @Column({ name: 'last_cleaned_at', type: 'timestamptz', nullable: true })
  lastCleanedAt: Date;

  @Column({ name: 'last_cleaned_by', type: 'uuid', nullable: true })
  lastCleanedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_cleaned_by' })
  lastCleanedByUser: User;

  @Column({ name: 'maintenance_notes', type: 'text', nullable: true })
  maintenanceNotes: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

