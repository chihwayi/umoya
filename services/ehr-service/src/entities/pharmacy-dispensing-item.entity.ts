import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Generated } from 'typeorm';
import { PharmacyDispensing } from './pharmacy-dispensing.entity';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { Drug } from './drug.entity';

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

  @ManyToOne(() => Drug, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ name: 'drug_id', type: 'uuid' })
  drugId: string;

  @Column({ name: 'rxnorm_code', type: 'varchar', length: 50, nullable: true })
  rxnormCode?: string;

  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber?: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'quantity_dispensed', type: 'int' })
  quantityDispensed: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;
  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2, generatedType: 'STORED', asExpression: 'quantity_dispensed * unit_price' })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


