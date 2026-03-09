import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('patient_portal_payments')
export class PatientPortalPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'payment_method', length: 30, nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'payment_reference', length: 100, nullable: true })
  paymentReference: string | null;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'paid_at', type: 'timestamp with time zone', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

