import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type StaffNotificationType =
  | 'task_assigned'
  | 'task_overdue'
  | 'lab_result_ready'
  | 'critical_alert'
  | 'patient_admitted'
  | 'patient_discharged'
  | 'shift_update'
  | 'message_received'
  | 'care_gap'
  | 'system_alert'
  | 'general';

export type StaffNotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

@Entity('staff_notifications')
export class StaffNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', length: 120 })
  tenantId: string;

  /** The user this notification is for (nurse, doctor, admin) */
  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ name: 'recipient_role', length: 50, nullable: true })
  recipientRole?: string;

  @Column({ name: 'notification_type', length: 60 })
  notificationType: StaffNotificationType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'action_url', length: 500, nullable: true })
  actionUrl?: string;

  @Column({ name: 'action_label', length: 100, nullable: true })
  actionLabel?: string;

  @Column({ length: 20, default: 'normal' })
  priority: StaffNotificationPriority;

  @Column({ default: false })
  read: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  /** Optional source entity (task id, lab order id, etc.) for deduplication */
  @Column({ name: 'source_entity_id', nullable: true })
  sourceEntityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
