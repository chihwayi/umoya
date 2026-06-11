import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Audit trail of notifications dispatched by the notification center — both
 * automated trigger sends and manual reminders. Powers the Notifications /
 * Audit Trail view.
 */
@Entity('notification_log')
@Index(['createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trigger_key', nullable: true })
  triggerKey: string;

  // 'sms' | 'email'
  @Column({ name: 'channel' })
  channel: string;

  @Column({ name: 'recipient' })
  recipient: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string;

  @Column({ name: 'subject', nullable: true })
  subject: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  // 'sent' | 'failed' | 'skipped'
  @Column({ name: 'status', default: 'sent' })
  status: string;

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string;

  @Column({ name: 'sent_by', type: 'uuid', nullable: true })
  sentBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
