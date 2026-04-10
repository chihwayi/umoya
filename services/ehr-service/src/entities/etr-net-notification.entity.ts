import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('etr_net_notifications')
export class EtrNetNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'tb_case_id', type: 'uuid', nullable: true }) tbCaseId: string | null;
  @Column({ name: 'notification_date', type: 'date' }) notificationDate: string;
  @Column({ name: 'export_status', length: 20, default: 'pending' }) exportStatus: string;
  @Column({ name: 'etr_reference', length: 50, nullable: true }) etrReference: string | null;
  @Column({ name: 'payload_json', type: 'jsonb', nullable: true }) payloadJson: Record<string, any> | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
