import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('notification_campaign_recipients')
export class NotificationCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ length: 255, nullable: true })
  destination: string | null;

  @Column({ length: 20, default: 'queued' })
  status: string;

  @Column({ name: 'message_id', length: 100, nullable: true })
  messageId: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp with time zone', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

