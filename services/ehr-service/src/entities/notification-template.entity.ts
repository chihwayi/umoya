import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_key', length: 80, unique: true })
  templateKey: string;

  @Column({ name: 'channel', length: 20 })
  channel: string;

  @Column({ name: 'language', length: 10, default: 'en' })
  language: string;

  @Column({ name: 'subject', length: 200, nullable: true })
  subject: string | null;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
