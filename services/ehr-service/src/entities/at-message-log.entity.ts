import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('at_message_logs')
export class AtMessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'channel', length: 20 })
  channel: string; // sms | ussd | whatsapp

  @Column({ name: 'direction', length: 10 })
  direction: string; // outbound | inbound

  @Column({ name: 'phone_number', length: 30 })
  phoneNumber: string;

  @Column({ name: 'message_text', type: 'text' })
  messageText: string;

  @Column({ name: 'message_type', length: 50, nullable: true })
  messageType: string | null;

  @Column({ name: 'status', length: 20, default: 'sent' })
  status: string;

  @Column({ name: 'at_message_id', length: 100, nullable: true })
  atMessageId: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'NOW()' })
  sentAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
