import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PharmacyPurchaseOrder } from './pharmacy-purchase-order.entity';
import { PharmacySupplier } from './pharmacy-supplier.entity';
import { User } from './user.entity';
import { PharmacyReceiptItem } from './pharmacy-receipt-item.entity';

export type ReceiptStatus = 'pending' | 'verified' | 'rejected' | 'processed';

@Entity('pharmacy_receipts')
export class PharmacyReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_number', type: 'varchar', length: 50, unique: true })
  receiptNumber: string;

  @ManyToOne(() => PharmacyPurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PharmacyPurchaseOrder;

  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId?: string;

  @ManyToOne(() => PharmacySupplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: PharmacySupplier;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'receipt_date', type: 'date', default: () => 'CURRENT_DATE' })
  receiptDate: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receivedBy?: User;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy?: User;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedById?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReceiptStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => PharmacyReceiptItem, item => item.receipt, { cascade: true })
  items: PharmacyReceiptItem[];

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


