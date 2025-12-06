import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Prescription } from './prescription.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { PharmacyDispensingItem } from './pharmacy-dispensing-item.entity';

export type DispensingStatus = 'pending' | 'dispensed' | 'partial' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded';

@Entity('pharmacy_dispensings')
export class PharmacyDispensing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prescription_id' })
  prescription?: Prescription;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId?: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'dispensing_number', type: 'varchar', length: 50, unique: true, nullable: true })
  dispensingNumber?: string;

  @Column({ name: 'dispensing_date', type: 'date', default: () => 'CURRENT_DATE' })
  dispensingDate: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dispensed_by' })
  dispensedBy?: User;

  @Column({ name: 'dispensed_by', type: 'uuid', nullable: true })
  dispensedById?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: DispensingStatus;

  @Column({ name: 'payment_status', type: 'varchar', length: 20, default: 'pending' })
  paymentStatus: PaymentStatus;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => PharmacyDispensingItem, item => item.dispensing, { cascade: true })
  items: PharmacyDispensingItem[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: User;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


