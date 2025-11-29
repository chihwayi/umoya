import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Generated } from 'typeorm';
import { PharmacyReceipt } from './pharmacy-receipt.entity';
import { PharmacyPurchaseOrderItem } from './pharmacy-purchase-order-item.entity';
import { Drug } from './drug.entity';

export type ReceiptItemCondition = 'good' | 'damaged' | 'expired' | 'short_supply';

@Entity('pharmacy_receipt_items')
export class PharmacyReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyReceipt, receipt => receipt.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: PharmacyReceipt;

  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @ManyToOne(() => PharmacyPurchaseOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem?: PharmacyPurchaseOrderItem;

  @Column({ name: 'purchase_order_item_id', type: 'uuid', nullable: true })
  purchaseOrderItemId?: string;

  @ManyToOne(() => Drug, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ name: 'drug_id', type: 'uuid' })
  drugId: string;

  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber?: string;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ name: 'manufacturing_date', type: 'date', nullable: true })
  manufacturingDate?: Date;

  @Column({ name: 'quantity_received', type: 'int' })
  quantityReceived: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 })
  unitCost: number;
  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2, generatedType: 'STORED', asExpression: 'quantity_received * unit_cost' })
  totalCost: number;

  @Column({ type: 'varchar', length: 20, default: 'good' })
  condition: ReceiptItemCondition;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


