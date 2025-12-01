import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export type ConsentType = 'general_telehealth' | 'video_recording' | 'data_sharing' | 'research';
export type ConsentStatus = 'granted' | 'denied' | 'expired' | 'revoked';

@Entity('telemedicine_consents')
export class TelemedicineConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'consent_type', type: 'varchar', length: 30 })
  consentType: ConsentType;

  @Column({ name: 'consent_status', type: 'varchar', length: 20, default: 'granted' })
  consentStatus: ConsentStatus;

  @Column({ name: 'consent_date', type: 'timestamptz', default: () => 'NOW()' })
  consentDate: Date;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'revoked_date', type: 'timestamptz', nullable: true })
  revokedDate?: Date;

  @Column({ name: 'consent_document_url', type: 'text', nullable: true })
  consentDocumentUrl?: string;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'witnessed_by' })
  witnessedBy?: User;

  @Column({ name: 'witnessed_by', type: 'uuid', nullable: true })
  witnessedById?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}


