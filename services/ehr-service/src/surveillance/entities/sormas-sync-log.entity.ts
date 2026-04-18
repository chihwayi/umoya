import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'sormas_sync_log' })
export class SormasSyncLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'source_table', type: 'text' }) sourceTable: string;

  @Column({ name: 'local_case_id', type: 'uuid' }) localCaseId: string;

  @Column({ name: 'sormas_case_uuid', type: 'text', nullable: true }) sormasCaseUuid: string | null;

  @Column({ name: 'sormas_person_uuid', type: 'text', nullable: true }) sormasPersonUuid: string | null;

  @Column({ name: 'sormas_instance_url', type: 'text' }) sormasInstanceUrl: string;

  @Column({ name: 'sormas_disease', type: 'text' }) sormasDisease: string;

  @Column({ name: 'sync_direction', type: 'text' }) syncDirection: string;

  @Column({ name: 'sync_status', type: 'text', default: 'pending' }) syncStatus: string;

  @Column({ name: 'http_status_code', type: 'int', nullable: true }) httpStatusCode: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 }) retryCount: number;

  @Column({ name: 'last_attempted_at', type: 'timestamp', nullable: true }) lastAttemptedAt: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true }) lastSyncedAt: Date | null;

  @Column({ name: 'sormas_response', type: 'jsonb', default: {} }) sormasResponse: Record<string, any>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
}
