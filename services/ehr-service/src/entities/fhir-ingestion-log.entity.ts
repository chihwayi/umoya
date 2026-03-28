import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fhir_ingestion_logs')
export class FhirIngestionLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'source_system', type: 'text' }) sourceSystem: string;
  @Column({ name: 'bundle_id', type: 'text', nullable: true }) bundleId: string;
  @Column({ name: 'received_at', type: 'timestamptz' }) receivedAt: Date;
  @Column({ name: 'resources_received', type: 'int', default: 0 }) resourcesReceived: number;
  @Column({ name: 'resources_imported', type: 'int', default: 0 }) resourcesImported: number;
  @Column({ name: 'conflicts_detected', type: 'int', default: 0 }) conflictsDetected: number;
  @Column({ name: 'conflicts_resolved', type: 'int', default: 0 }) conflictsResolved: number;
  @Column({ type: 'text', default: 'pending' }) status: string; // pending|completed|partial|failed
  @Column({ name: 'error_details', type: 'jsonb', nullable: true }) errorDetails: any;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
