import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DiabetesRegistry } from './diabetes-registry.entity';
import { Patient } from './patient.entity';

export type DiabetesDeviceType = 'cgm' | 'insulin_pump' | 'glucose_meter' | 'smart_pen' | 'fitness_tracker' | 'other';
export type DiabetesDeviceIntegrationType = 'api' | 'hl7' | 'fhir' | 'manual' | 'healthkit' | 'google_fit' | 'file_upload';
export type DiabetesDeviceIntegrationStatus = 'active' | 'inactive' | 'error' | 'pending' | 'revoked';

@Entity('diabetes_device_integration')
export class DiabetesDeviceIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diabetes_registry_id', type: 'uuid' })
  diabetesRegistryId: string;

  @ManyToOne(() => DiabetesRegistry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diabetes_registry_id' })
  registry: DiabetesRegistry;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'device_type', type: 'varchar', length: 50 })
  deviceType: DiabetesDeviceType;

  @Column({ name: 'device_brand', type: 'varchar', length: 100, nullable: true })
  deviceBrand?: string;

  @Column({ name: 'device_model', type: 'varchar', length: 100, nullable: true })
  deviceModel?: string;

  @Column({ name: 'device_serial_number', type: 'varchar', length: 255, nullable: true })
  deviceSerialNumber?: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string;

  @Column({ name: 'integration_type', type: 'varchar', length: 30, nullable: true })
  integrationType?: DiabetesDeviceIntegrationType;

  @Column({ name: 'integration_status', type: 'varchar', length: 30, default: 'active' })
  integrationStatus: DiabetesDeviceIntegrationStatus;

  @Column({ name: 'last_sync_at', type: 'timestamp with time zone', nullable: true })
  lastSyncAt?: Date;

  @Column({ name: 'sync_frequency', type: 'varchar', length: 50, nullable: true })
  syncFrequency?: string;

  @Column({ name: 'api_credentials_encrypted', type: 'text', nullable: true })
  apiCredentialsEncrypted?: string;

  @Column({ type: 'jsonb', nullable: true, default: () => `'{}'::jsonb` })
  settings?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




