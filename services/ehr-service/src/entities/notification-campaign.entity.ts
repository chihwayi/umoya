import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('notification_campaigns')
export class NotificationCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 20, default: 'sms' })
  channel: string;

  @Column({ name: 'message_template', type: 'text' })
  messageTemplate: string;

  @Column({ name: 'target_type', length: 50, default: 'manual' })
  targetType: string;

  @Column({ name: 'target_ref_id', type: 'uuid', nullable: true })
  targetRefId: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  criteria: Record<string, any>;

  @Index()
  @Column({ length: 20, default: 'draft' })
  status: string;

  @Column({ name: 'scheduled_at', type: 'timestamp with time zone', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamp with time zone', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

