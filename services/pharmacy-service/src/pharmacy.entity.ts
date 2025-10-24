import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pharmacy_inventory')
export class PharmacyInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  drugName: string;

  @Column({ nullable: true })
  genericName: string;

  @Column()
  batchNumber: string;

  @Column('date')
  expiryDate: Date;

  @Column('int', { default: 0 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitCost: number;

  @Column('decimal', { precision: 10, scale: 2 })
  sellingPrice: number;

  @Column('int', { default: 10 })
  reorderLevel: number;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get isExpired(): boolean {
    return new Date() > this.expiryDate;
  }

  get isLowStock(): boolean {
    return this.quantity <= this.reorderLevel;
  }

  get profitMargin(): number {
    return ((this.sellingPrice - this.unitCost) / this.unitCost) * 100;
  }
}

@Entity('pharmacy_dispensing')
export class PharmacyDispensing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionId: string;

  @Column()
  inventoryId: string;

  @Column('int')
  quantityDispensed: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column()
  dispensedBy: string;

  @Column()
  dispensedAt: Date;

  @Column({ default: false })
  patientCounseled: boolean;

  @Column('text', { nullable: true })
  notes: string;
}