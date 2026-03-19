import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('openmrs_migration_logs')
export class OpenMrsMigrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id' })
  batchId: string;

  @Column({ name: 'resource_type' }) // Patient | Encounter | Obs | Drug | Order
  resourceType: string;

  @Column({ name: 'openmrs_uuid', nullable: true })
  openmrsUuid: string;

  @Column({ name: 'medicore_id', nullable: true })
  medicoreId: string;

  @Column({ default: 'migrated' }) // migrated | skipped | failed | conflict
  status: string;

  @Column({ name: 'error_details', nullable: true })
  errorDetails: string;

  @Column({ name: 'raw_record', type: 'jsonb', nullable: true })
  rawRecord: Record<string, any>;

  @CreateDateColumn({ name: 'migrated_at' })
  migratedAt: Date;
}
