import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Drug } from './drug.entity';
import { PharmacySupplier } from './pharmacy-supplier.entity';
import { User } from './user.entity';

export type PricingRuleType = 'markup_percentage' | 'markup_fixed' | 'discount_percentage' | 'discount_fixed' | 'fixed_price';
export type PricingRuleAppliesTo = 'all' | 'category' | 'drug' | 'supplier';

@Entity('pharmacy_pricing_rules')
export class PharmacyPricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 255 })
  ruleName: string;

  @Column({ name: 'rule_type', type: 'varchar', length: 30 })
  ruleType: PricingRuleType;

  @Column({ name: 'markup_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  markupPercentage?: number;

  @Column({ name: 'markup_fixed', type: 'decimal', precision: 12, scale: 2, nullable: true })
  markupFixed?: number;

  @Column({ name: 'discount_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercentage?: number;

  @Column({ name: 'discount_fixed', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountFixed?: number;

  @Column({ name: 'fixed_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fixedPrice?: number;

  @Column({ name: 'applies_to', type: 'varchar', length: 20 })
  appliesTo: PricingRuleAppliesTo;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string;

  @ManyToOne(() => Drug, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'drug_id' })
  drug?: Drug;

  @Column({ name: 'drug_id', type: 'uuid', nullable: true })
  drugId?: string;

  @ManyToOne(() => PharmacySupplier, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: PharmacySupplier;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId?: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'valid_from', type: 'date', default: () => 'CURRENT_DATE' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

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


