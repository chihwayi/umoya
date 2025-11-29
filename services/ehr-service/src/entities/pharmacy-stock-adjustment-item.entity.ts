import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyStockAdjustment } from './pharmacy-stock-adjustment.entity';
import { PharmacyInventory } from './pharmacy-inventory.entity';

@Entity('pharmacy_stock_adjustment_items')
export class PharmacyStockAdjustmentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyStockAdjustment, adjustment => adjustment.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adjustment_id' })
  adjustment: PharmacyStockAdjustment;

  @Column({ name: 'adjustment_id', type: 'uuid' })
  adjustmentId: string;

  @ManyToOne(() => PharmacyInventory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @Column({ name: 'quantity_before', type: 'int' })
  quantityBefore: number;

  @Column({ name: 'quantity_adjustment', type: 'int' })
  quantityAdjustment: number;

  @Column({ name: 'quantity_after', type: 'int' })
  quantityAfter: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitCost?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


