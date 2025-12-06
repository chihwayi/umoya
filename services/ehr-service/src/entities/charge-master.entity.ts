import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('charge_master')
export class ChargeMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'charge_code', length: 50, unique: true })
  chargeCode: string;

  @Column({ name: 'charge_description', type: 'text' })
  chargeDescription: string;

  @Column({ name: 'cpt_code', length: 10, nullable: true })
  cptCode: string;

  @Column({ name: 'hcpcs_code', length: 10, nullable: true })
  hcpcsCode: string;

  @Column({ name: 'revenue_code', length: 10, nullable: true })
  revenueCode: string;

  @Column({ name: 'standard_charge', type: 'decimal', precision: 10, scale: 2 })
  standardCharge: number;

  @Column({ name: 'medicare_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  medicareRate: number;

  @Column({ name: 'medicaid_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  medicaidRate: number;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ name: 'service_category', length: 100, nullable: true })
  serviceCategory: string;

  @Column({ default: true })
  billable: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




