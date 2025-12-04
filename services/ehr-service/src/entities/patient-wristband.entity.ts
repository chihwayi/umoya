import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('patient_wristbands')
@Index(['barcode'], { unique: true })
export class PatientWristband {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @Column({ length: 100, unique: true })
  barcode: string;

  @Column({ name: 'wristband_type', length: 50, default: 'standard' })
  wristbandType: string;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt: Date;

  @Column({ name: 'issued_by', nullable: true })
  issuedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issued_by' })
  issuedBy: User;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date;

  @Column({ name: 'deactivated_by', nullable: true })
  deactivatedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'deactivated_by' })
  deactivatedBy: User;

  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

