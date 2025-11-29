import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PharmacySupplier } from './pharmacy-supplier.entity';
import { User } from './user.entity';
import { PharmacyPurchaseOrderItem } from './pharmacy-purchase-order-item.entity';

export type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';

@Entity('pharmacy_purchase_orders')
export class PharmacyPurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @ManyToOne(() => PharmacySupplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: PharmacySupplier;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'order_date', type: 'date', default: () => 'CURRENT_DATE' })
  orderDate: Date;

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate?: Date;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: PurchaseOrderStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy?: User;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedById?: string;

  @Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
  approvedAt?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ordered_by' })
  orderedBy?: User;

  @Column({ name: 'ordered_by', type: 'uuid', nullable: true })
  orderedById?: string;

  @OneToMany(() => PharmacyPurchaseOrderItem, item => item.purchaseOrder, { cascade: true })
  items: PharmacyPurchaseOrderItem[];

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


