import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('openmrs_sync_logs')
export class OpenmrsSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'openmrs_uuid', length: 80, nullable: true })
  openmrsUuid: string | null;

  @Column({ length: 10 })
  direction: string;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'synced_at', type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
