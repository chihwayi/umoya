import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Patient } from './patient.entity';

export type NotificationType = 
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'lab_results_ready'
  | 'prescription_ready'
  | 'bill_generated'
  | 'payment_received'
  | 'message_received'
  | 'system_alert'
  | 'general';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

@Entity('patient_notifications')
@Index(['tenantId'])
@Index(['patientId'])
@Index(['patientId', 'read'])
@Index(['notificationType'])
@Index(['sentAt'])
export class PatientNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'notification_type', type: 'varchar', length: 50 })
  notificationType: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'action_url', type: 'varchar', length: 500, nullable: true })
  actionUrl?: string;

  @Column({ name: 'action_label', type: 'varchar', length: 100, nullable: true })
  actionLabel?: string;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: Priority;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  sentAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

