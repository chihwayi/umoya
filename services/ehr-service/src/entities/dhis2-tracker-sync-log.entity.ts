import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dhis2_tracker_sync_log')
export class Dhis2TrackerSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', length: 50 })
  entityType: 'patient' | 'immunization' | 'encounter';

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ name: 'dhis2_tei_uid', length: 50, nullable: true })
  dhis2TeiUid: string;

  @Column({ name: 'dhis2_enrollment_uid', length: 50, nullable: true })
  dhis2EnrollmentUid: string;

  @Column({ name: 'dhis2_event_uid', length: 50, nullable: true })
  dhis2EventUid: string;

  @Column({ name: 'program_uid', length: 50, nullable: true })
  programUid: string;

  @Column({ name: 'org_unit_uid', length: 50, nullable: true })
  orgUnitUid: string;

  @Column({ name: 'sync_status', length: 20, default: 'pending' })
  syncStatus: 'pending' | 'synced' | 'failed';

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
