import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sync_queue_logs')
export class SyncQueueLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'client_id', type: 'text' }) clientId: string;
  // S225: stable per-operation idempotency key from the device queue.
  @Column({ name: 'client_op_id', type: 'text', nullable: true }) clientOpId: string;
  @Column({ name: 'operation_type', type: 'text' }) operationType: string; // create|update
  @Column({ name: 'entity_type', type: 'text' }) entityType: string; // vitals|medical_record|prescription|lab_order
  @Column({ name: 'entity_id', type: 'uuid', nullable: true }) entityId: string;
  @Column({ type: 'jsonb' }) payload: Record<string, any>;
  @Column({ name: 'sync_status', type: 'text', default: 'pending' }) syncStatus: string; // pending|synced|conflict|failed
  @Column({ name: 'client_timestamp', type: 'timestamptz' }) clientTimestamp: Date;
  @Column({ name: 'server_timestamp', type: 'timestamptz', nullable: true }) serverTimestamp: Date;
  @Column({ name: 'conflict_details', type: 'jsonb', nullable: true }) conflictDetails: Record<string, any>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
