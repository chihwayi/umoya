import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { User } from './user.entity';

export type MovementType = 'purchase' | 'sale' | 'return' | 'adjustment' | 'expiry' | 'damage' | 'transfer';

@Entity('pharmacy_stock_movements')
export class PharmacyStockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyInventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @Column({ name: 'movement_type', type: 'varchar', length: 20 })
  movementType: MovementType;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType?: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId?: string;

  @Column({ name: 'quantity_before', type: 'int' })
  quantityBefore: number;

  @Column({ name: 'quantity_change', type: 'int' })
  quantityChange: number;

  @Column({ name: 'quantity_after', type: 'int' })
  quantityAfter: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitCost?: number;

  @Column({ name: 'movement_date', type: 'date', default: () => 'CURRENT_DATE' })
  movementDate: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy?: User;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedById?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}


