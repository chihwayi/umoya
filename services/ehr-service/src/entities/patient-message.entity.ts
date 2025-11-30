import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Patient } from './patient.entity';

export type SenderType = 'patient' | 'staff' | 'doctor' | 'system';
export type RecipientType = 'patient' | 'staff' | 'doctor' | 'system';
export type MessageType = 'general' | 'appointment' | 'lab_results' | 'prescription' | 'billing' | 'urgent';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

@Entity('patient_messages')
@Index(['tenantId'])
@Index(['patientId'])
@Index(['senderType', 'senderId'])
@Index(['recipientType', 'recipientId'])
@Index(['patientId', 'read'])
@Index(['createdAt'])
export class PatientMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'sender_type', type: 'varchar', length: 50 })
  senderType: SenderType;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId?: string;

  @Column({ name: 'recipient_type', type: 'varchar', length: 50 })
  recipientType: RecipientType;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'message_type', type: 'varchar', length: 50, default: 'general' })
  messageType: MessageType;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: Priority;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: any;

  @Column({ name: 'parent_message_id', type: 'uuid', nullable: true })
  parentMessageId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}

