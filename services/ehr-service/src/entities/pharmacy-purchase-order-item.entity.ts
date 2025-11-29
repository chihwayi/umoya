import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Generated } from 'typeorm';
import { PharmacyPurchaseOrder } from './pharmacy-purchase-order.entity';
import { Drug } from './drug.entity';

@Entity('pharmacy_purchase_order_items')
export class PharmacyPurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyPurchaseOrder, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PharmacyPurchaseOrder;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => Drug, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ name: 'drug_id', type: 'uuid' })
  drugId: string;

  @Column({ name: 'rxnorm_code', type: 'varchar', length: 50, nullable: true })
  rxnormCode?: string;

  @Column({ name: 'quantity_ordered', type: 'int' })
  quantityOrdered: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 })
  unitCost: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2, generatedType: 'STORED', asExpression: 'quantity_ordered * unit_cost' })
  @Generated('STORED')
  totalCost: number;

  @Column({ name: 'quantity_received', type: 'int', default: 0 })
  quantityReceived: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


