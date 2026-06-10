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

@Entity('billing')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number' })
  billNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @ManyToOne(() => AppointmentSimple)
  @JoinColumn({ name: 'appointment_id' })
  appointment: AppointmentSimple;

  // Items are not stored in the billing table - they're calculated from other sources
  // This is just for TypeScript typing when working with bill data
  items?: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: 'consultation' | 'procedure' | 'medication' | 'lab' | 'imaging' | 'other';
  }>;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: BillStatus.DRAFT })
  status: BillStatus;

  @Column({ name: 'billing_date', type: 'date' })
  billDate: Date;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate?: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'diagnosis_codes', type: 'text', array: true, nullable: true })
  diagnosisCodes?: string[];

  @Column({ name: 'primary_diagnosis_code', type: 'varchar', length: 50, nullable: true })
  primaryDiagnosisCode?: string;

  @Column({ name: 'primary_diagnosis_description', type: 'text', nullable: true })
  primaryDiagnosisDescription?: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  // Payments, paidAmount, balanceAmount, and insurance are not in the billing table
  // They're managed through the financial_transactions table
  payments?: Array<{
    amount: number;
    method: PaymentMethod;
    reference: string;
    date: Date;
    receivedBy: string;
  }>;

  paidAmount?: number;
  balanceAmount?: number;

  insurance?: {
    provider: string;
    policyNumber: string;
    coveragePercentage: number;
    claimNumber?: string;
    claimStatus?: 'pending' | 'approved' | 'rejected';
  };
  @Column({ name: 'billing_date', type: 'date' })
  billingDate: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency?: string;

  @Column({ name: 'diagnosis_codes', type: 'text', array: true, nullable: true })
  diagnosisCodesId?: string[];

  @Column({ name: 'discount_amount', type: 'numeric', precision: 12, scale: 2, nullable: true, default: 0 })
  discountAmountId: number = 0;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDateId?: Date;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDateId?: Date;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notesId?: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ name: 'payment_reference', type: 'varchar', length: 255, nullable: true })
  paymentReference?: string;

  @Column({ name: 'primary_diagnosis_code', type: 'varchar', length: 50, nullable: true })
  primaryDiagnosisCodeId?: string;

  @Column({ name: 'primary_diagnosis_description', type: 'text', nullable: true })
  primaryDiagnosisDescriptionId?: string;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  statusId: string;

  @Column({ name: 'subtotal', type: 'numeric', precision: 12, scale: 2, nullable: true })
  subtotalId?: number;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 12, scale: 2, nullable: true, default: 0 })
  taxAmountId: number = 0;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmountId: number;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
