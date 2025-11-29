import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Generated } from 'typeorm';
import { Drug } from './drug.entity';
import { PharmacySupplier } from './pharmacy-supplier.entity';
import { User } from './user.entity';

export type InventoryStatus = 'active' | 'discontinued' | 'expired' | 'recalled';

@Entity('pharmacy_inventory')
export class PharmacyInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ name: 'drug_id', type: 'uuid' })
  drugId: string;

  @Column({ name: 'rxnorm_code', type: 'varchar', length: 50, nullable: true })
  rxnormCode?: string;

  @Column({ name: 'rxnorm_name', type: 'text', nullable: true })
  rxnormName?: string;

  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber?: string;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ name: 'manufacturing_date', type: 'date', nullable: true })
  manufacturingDate?: Date;

  @Column({ name: 'quantity_on_hand', type: 'int', default: 0 })
  quantityOnHand: number;

  @Column({ name: 'quantity_reserved', type: 'int', default: 0 })
  quantityReserved: number;
  @Column({ name: 'quantity_available', type: 'int', generatedType: 'STORED', asExpression: 'quantity_on_hand - quantity_reserved' })
  quantityAvailable: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 })
  unitCost: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ name: 'reorder_level', type: 'int', default: 10 })
  reorderLevel: number;

  @Column({ name: 'reorder_quantity', type: 'int', default: 50 })
  reorderQuantity: number;

  @Column({ name: 'maximum_stock_level', type: 'int', nullable: true })
  maximumStockLevel?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string;

  @Column({ name: 'storage_conditions', type: 'varchar', length: 255, nullable: true })
  storageConditions?: string;

  @ManyToOne(() => PharmacySupplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: PharmacySupplier;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId?: string;

  @Column({ name: 'last_purchase_date', type: 'date', nullable: true })
  lastPurchaseDate?: Date;

  @Column({ name: 'last_purchase_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  lastPurchasePrice?: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: InventoryStatus;

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


