import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'offline_sync_queue' })
export class OfflineSyncQueue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'device_id' }) deviceId: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column({ name: 'operation_type' }) operationType: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'local_entity_id' }) localEntityId: string;
  @Column({ name: 'payload', type: 'jsonb' }) payload: object;
  @Column({ name: 'sync_status', default: 'pending' }) syncStatus: string;
  @Column({ name: 'server_entity_id', nullable: true }) serverEntityId: string;
  @Column({ name: 'conflict_details', type: 'jsonb', default: {} }) conflictDetails: object;
  @Column({ name: 'error_message', nullable: true }) errorMessage: string;
  @Column({ name: 'retry_count', default: 0 }) retryCount: number;
  @Column({ name: 'created_offline_at', type: 'timestamp' }) createdOfflineAt: Date;
  @Column({ name: 'synced_at', type: 'timestamp', nullable: true }) syncedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
