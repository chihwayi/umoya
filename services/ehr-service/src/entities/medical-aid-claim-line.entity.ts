import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalAidClaim } from './medical-aid-claim.entity';

/**
 * An itemised line on a medical-aid claim — one tariff-coded procedure/service
 * with quantity and amount. Brings Umoya claims to Zimbabwe billing parity
 * (AHFoZ tariff schedules, dental tooth/quadrant, ICD-10 linkage).
 */
@Entity('medical_aid_claim_lines')
@Index(['claimId'])
export class MedicalAidClaimLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @ManyToOne(() => MedicalAidClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: MedicalAidClaim;

  @Column({ name: 'tariff_code', nullable: true })
  tariffCode: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitAmount: string;

  @Column({ name: 'line_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  lineAmount: string;

  // Dental-specific positioning (optional)
  @Column({ name: 'tooth_number', nullable: true })
  toothNumber: string;

  @Column({ name: 'quadrant', nullable: true })
  quadrant: string;

  @Column({ name: 'icd10_code', nullable: true })
  icd10Code: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
