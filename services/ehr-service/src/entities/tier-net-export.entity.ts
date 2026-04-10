import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('tier_net_exports')
export class TierNetExport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'export_date', type: 'date' }) exportDate: string;
  @Column({ name: 'export_type', length: 20 }) exportType: string;
  @Column({ name: 'export_status', length: 20, default: 'pending' }) exportStatus: string;
  @Column({ name: 'tier_net_uid', length: 50, nullable: true }) tierNetUid: string | null;
  @Column({ name: 'payload_xml', type: 'text', nullable: true }) payloadXml: string | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
