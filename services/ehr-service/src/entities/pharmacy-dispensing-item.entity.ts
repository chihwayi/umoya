import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Generated } from 'typeorm';
import { PharmacyDispensing } from './pharmacy-dispensing.entity';
import { PharmacyInventory } from './pharmacy-inventory.entity';
// Note: Drug entity removed from imports since drug_id column doesn't exist in DB

@Entity('pharmacy_dispensing_items')
export class PharmacyDispensingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyDispensing, dispensing => dispensing.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispensing_id' })
  dispensing: PharmacyDispensing;

  @Column({ name: 'dispensing_id', type: 'uuid' })
  dispensingId: string;

  @ManyToOne(() => PharmacyInventory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  // Note: drug_id column doesn't exist in database schema
  // Drug information is accessed via inventory -> drug relationship
  // drugId?: string;
  // drug?: Drug;

  // Note: These columns don't exist in database schema - they're virtual properties
  // rxnormCode?: string;
  // batchNumber?: string;
  // expiryDate?: Date;
  // instructions?: string;

  @Column({ name: 'quantity_dispensed', type: 'int' })
  quantityDispensed: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;
  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2, generatedType: 'STORED', asExpression: 'quantity_dispensed * unit_price' })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


