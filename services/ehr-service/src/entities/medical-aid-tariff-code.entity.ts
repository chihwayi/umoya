import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Reference catalog of medical-aid tariff/procedure codes (e.g. the AHFoZ
 * schedules used by Zimbabwe medical aids). Claim lines reference these codes.
 * Seeded with a starter set by the provisioning bundle; the full schedule is
 * loaded per deployment.
 */
@Entity('medical_aid_tariff_codes')
@Index(['schedule'])
export class MedicalAidTariffCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code', unique: true })
  code: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  // 'gp' | 'dental' | 'general' | scheme-specific schedule key
  @Column({ name: 'schedule', default: 'general' })
  schedule: string;

  @Column({ name: 'category', nullable: true })
  category: string;

  @Column({ name: 'default_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  defaultAmount: string;

  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
