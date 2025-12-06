import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { Admission } from './admission.entity';

@Entity('charge_approval_notifications')
export class ChargeApprovalNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission: Admission;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'notification_type', length: 50, default: 'charge_approved' })
  notificationType: string;

  @Column({ name: 'notification_status', length: 50, default: 'unread' })
  notificationStatus: string;

  @Column({ name: 'total_charges_count', type: 'integer', default: 0 })
  totalChargesCount: number;

  @Column({ name: 'total_charges_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalChargesAmount: number;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'read_by', nullable: true })
  readById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'read_by' })
  readBy: User;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: any;
}


