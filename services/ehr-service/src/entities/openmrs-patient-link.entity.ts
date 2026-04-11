import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('openmrs_patient_links')
export class OpenmrsPatientLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'openmrs_uuid', length: 80, unique: true })
  openmrsUuid: string;

  @Column({ name: 'openmrs_base_url', length: 255 })
  openmrsBaseUrl: string;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'sync_status', length: 20, default: 'pending' })
  syncStatus: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
