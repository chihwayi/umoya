import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Per-tenant toggle for an automated notification trigger (e.g. appointment
 * booked, appointment reminder, payment received, claim status updated, staff
 * invitation). Each trigger can independently dispatch over SMS and/or Email.
 */
@Entity('notification_trigger_configs')
export class NotificationTriggerConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trigger_key', unique: true })
  triggerKey: string;

  @Column({ name: 'label' })
  label: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sms_enabled', type: 'boolean', default: true })
  smsEnabled: boolean;

  @Column({ name: 'email_enabled', type: 'boolean', default: true })
  emailEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
