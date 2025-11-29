import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Drug } from './drug.entity';
import { User } from './user.entity';

@Entity('pharmacy_formulary')
export class PharmacyFormulary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'medical_aid_id', type: 'uuid', nullable: true })
  medicalAidId?: string;

  @Column({ name: 'medical_aid_name', type: 'varchar', length: 255, nullable: true })
  medicalAidName?: string;

  @ManyToOne(() => Drug, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ name: 'drug_id', type: 'uuid' })
  drugId: string;

  @Column({ name: 'rxnorm_code', type: 'varchar', length: 50, nullable: true })
  rxnormCode?: string;

  @Column({ type: 'boolean', default: true })
  covered: boolean;

  @Column({ name: 'requires_prior_auth', type: 'boolean', default: false })
  requiresPriorAuth: boolean;

  @Column({ name: 'co_pay_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coPayAmount?: number;

  @Column({ name: 'co_pay_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  coPayPercentage?: number;

  @Column({ name: 'max_quantity_per_month', type: 'int', nullable: true })
  maxQuantityPerMonth?: number;

  @Column({ name: 'max_days_supply', type: 'int', nullable: true })
  maxDaysSupply?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tier?: string;

  @Column({ name: 'effective_date', type: 'date', default: () => 'CURRENT_DATE' })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

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


