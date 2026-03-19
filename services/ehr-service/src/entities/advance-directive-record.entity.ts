import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('advance_directive_records')
export class AdvanceDirectiveRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'document_type', type: 'text' }) documentType: string;
  @Column({ name: 'document_date', type: 'date' }) documentDate: string;
  @Column({ type: 'text', nullable: true }) summary: string;
  @Column({ name: 'witness_name', type: 'text', nullable: true }) witnessName: string;
  @Column({ name: 'physician_name', type: 'text', nullable: true }) physicianName: string;
  @Column({ name: 'storage_key', type: 'text', nullable: true }) storageKey: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'superseded_by_id', type: 'uuid', nullable: true }) supersededById: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
