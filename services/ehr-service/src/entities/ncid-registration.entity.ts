import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ncid_registrations' })
@Index(['idNumberHash'])
@Index(['patientId'])
export class NcidRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'country_code', length: 2 })
  countryCode: string;

  @Column({ name: 'id_type' })
  idType: string;

  @Column({ name: 'id_number' })
  idNumber: string;

  @Column({ name: 'id_number_hash' })
  idNumberHash: string;

  @Column({ name: 'id_number_formatted', nullable: true })
  idNumberFormatted: string | null;

  @Column({ name: 'verified', default: false })
  verified: boolean;

  @Column({ name: 'verification_method', nullable: true })
  verificationMethod: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'biometric_hash', nullable: true })
  biometricHash: string | null;

  @Column({ name: 'biometric_captured_at', type: 'timestamptz', nullable: true })
  biometricCapturedAt: Date | null;

  @Column({ name: 'national_registry_synced', default: false })
  nationalRegistrySynced: boolean;

  @Column({ name: 'national_registry_ref', nullable: true })
  nationalRegistryRef: string | null;

  @Column({ name: 'national_registry_synced_at', type: 'timestamptz', nullable: true })
  nationalRegistrySyncedAt: Date | null;

  @Column({ name: 'national_registry_response', type: 'jsonb', default: {} })
  nationalRegistryResponse: Record<string, unknown>;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
