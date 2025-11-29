import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyReturn } from './pharmacy-return.entity';
import { PharmacyDispensingItem } from './pharmacy-dispensing-item.entity';
import { PharmacyInventory } from './pharmacy-inventory.entity';

export type ReturnItemCondition = 'good' | 'damaged' | 'expired';

@Entity('pharmacy_return_items')
export class PharmacyReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyReturn, return_ => return_.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  return: PharmacyReturn;

  @Column({ name: 'return_id', type: 'uuid' })
  returnId: string;

  @ManyToOne(() => PharmacyDispensingItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dispensing_item_id' })
  dispensingItem?: PharmacyDispensingItem;

  @Column({ name: 'dispensing_item_id', type: 'uuid', nullable: true })
  dispensingItemId?: string;

  @ManyToOne(() => PharmacyInventory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inventory_id' })
  inventory?: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid', nullable: true })
  inventoryId?: string;

  @Column({ name: 'quantity_returned', type: 'int' })
  quantityReturned: number;

  @Column({ type: 'varchar', length: 20, default: 'good' })
  condition: ReturnItemCondition;

  @Column({ type: 'boolean', default: false })
  restockable: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


