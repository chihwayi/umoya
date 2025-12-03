import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientConsent } from './patient-consent.entity';
import { User } from './user.entity';

@Entity('consent_signatures')
export class ConsentSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'consent_id', type: 'uuid' })
  consentId: string;

  @ManyToOne(() => PatientConsent, consent => consent.signatures)
  @JoinColumn({ name: 'consent_id' })
  consent: PatientConsent;

  @Column({ name: 'signer_role', length: 50 })
  signerRole: string;

  @Column({ name: 'signer_id', type: 'uuid', nullable: true })
  signerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'signer_id' })
  signer: User;

  @Column({ name: 'signer_name', length: 255 })
  signerName: string;

  @Column({ name: 'signer_relationship', length: 100, nullable: true })
  signerRelationship: string;

  @Column({ name: 'signature_type', length: 50 })
  signatureType: string;

  @Column({ name: 'signature_data', type: 'text' })
  signatureData: string;

  @Column({ name: 'signature_method', length: 100, nullable: true })
  signatureMethod: string;

  @Column({ name: 'signed_at', type: 'timestamptz', default: () => 'NOW()' })
  signedAt: Date;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ name: 'geolocation', type: 'jsonb', nullable: true })
  geolocation: { lat: number; lon: number; accuracy: number };

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: Record<string, any>;

  @Column({ name: 'verification_code', length: 100, nullable: true })
  verificationCode: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'is_valid', default: true })
  isValid: boolean;

  @Column({ name: 'invalidated_reason', type: 'text', nullable: true })
  invalidatedReason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

