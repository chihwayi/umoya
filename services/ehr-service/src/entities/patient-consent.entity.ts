import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { ConsentTemplate } from './consent-template.entity';
import { ConsentSignature } from './consent-signature.entity';

@Entity('patient_consents')
export class PatientConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'consent_number', length: 50, unique: true })
  consentNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string;

  @ManyToOne(() => ConsentTemplate, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template: ConsentTemplate;

  @Column({ name: 'template_version', length: 20 })
  templateVersion: string;

  @Column({ name: 'consent_type', length: 50 })
  consentType: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({ name: 'procedure_id', type: 'uuid', nullable: true })
  procedureId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'filled_fields', type: 'jsonb', default: '{}' })
  filledFields: Record<string, any>;

  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'language_code', length: 10, default: 'en' })
  languageCode: string;

  @Column({ name: 'consent_date', type: 'timestamptz', nullable: true })
  consentDate: Date;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date;

  @Column({ length: 255, nullable: true })
  location: string;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'presented_by', type: 'uuid', nullable: true })
  presentedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'presented_by' })
  presentedByUser: User;

  @Column({ name: 'presented_at', type: 'timestamptz', nullable: true })
  presentedAt: Date;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date;

  @Column({ name: 'declined_at', type: 'timestamptz', nullable: true })
  declinedAt: Date;

  @Column({ name: 'decline_reason', type: 'text', nullable: true })
  declineReason: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason: string;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revokedByUser: User;

  @Column({ name: 'superseded_by', type: 'uuid', nullable: true })
  supersededBy: string;

  @ManyToOne(() => PatientConsent, { nullable: true })
  @JoinColumn({ name: 'superseded_by' })
  supersededByConsent: PatientConsent;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @OneToMany(() => ConsentSignature, signature => signature.consent)
  signatures: ConsentSignature[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

