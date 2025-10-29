import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { AppointmentSimple } from './appointment-simple.entity';

export enum BillStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_MONEY = 'mobile_money',
  INSURANCE = 'insurance',
  MEDICAL_AID = 'medical_aid'
}

@Entity('bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  billNumber: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  appointmentId: string;

  @ManyToOne(() => AppointmentSimple)
  @JoinColumn({ name: 'appointmentId' })
  appointment: AppointmentSimple;

  @Column({ type: 'json' })
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: 'consultation' | 'procedure' | 'medication' | 'lab' | 'imaging' | 'other';
  }>;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: BillStatus, default: BillStatus.DRAFT })
  status: BillStatus;

  @Column({ type: 'date' })
  billDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'json', nullable: true })
  payments: Array<{
    amount: number;
    method: PaymentMethod;
    reference: string;
    date: Date;
    receivedBy: string;
  }>;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceAmount: number;

  @Column({ type: 'json', nullable: true })
  insurance: {
    provider: string;
    policyNumber: string;
    coveragePercentage: number;
    claimNumber?: string;
    claimStatus?: 'pending' | 'approved' | 'rejected';
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}