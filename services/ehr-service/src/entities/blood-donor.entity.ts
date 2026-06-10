import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('blood_donors')
export class BloodDonor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: Date;

  @Column({ length: 20 })
  gender: string;

  @Column({ name: 'national_id', length: 50, nullable: true })
  nationalId: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'blood_group', length: 5 })
  bloodGroup: string;

  @Column({ name: 'rh_factor', length: 10 })
  rhFactor: string;

  @Column({ name: 'donor_type', length: 50, default: 'voluntary' })
  donorType: string;

  @Column({ name: 'donor_status', length: 50, default: 'active' })
  donorStatus: string;

  @Column({ name: 'last_donation_date', type: 'date', nullable: true })
  lastDonationDate: Date;

  @Column({ name: 'total_donations', default: 0 })
  totalDonations: number;

  @Column({ name: 'deferral_reason', type: 'text', nullable: true })
  deferralReason: string;

  @Column({ name: 'deferral_until', type: 'date', nullable: true })
  deferralUntil: Date;

  @Column({ name: 'willing_to_donate', default: true })
  willingToDonate: boolean;

  @Column({ name: 'preferred_contact', length: 50, default: 'phone' })
  preferredContact: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

