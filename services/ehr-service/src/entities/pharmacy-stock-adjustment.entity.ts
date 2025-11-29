import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { PharmacyStockAdjustmentItem } from './pharmacy-stock-adjustment-item.entity';

export type AdjustmentType = 'increase' | 'decrease' | 'correction';
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected' | 'processed';

@Entity('pharmacy_stock_adjustments')
export class PharmacyStockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'adjustment_number', type: 'varchar', length: 50, unique: true })
  adjustmentNumber: string;

  @Column({ name: 'adjustment_date', type: 'date', default: () => 'CURRENT_DATE' })
  adjustmentDate: Date;

  @Column({ name: 'adjustment_type', type: 'varchar', length: 20 })
  adjustmentType: AdjustmentType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reason?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy?: User;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy?: User;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedById?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AdjustmentStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => PharmacyStockAdjustmentItem, item => item.adjustment, { cascade: true })
  items: PharmacyStockAdjustmentItem[];

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


