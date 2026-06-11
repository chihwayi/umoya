import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalAidRemittance } from './medical-aid-remittance.entity';

/**
 * One reconciled line of a medical-aid remittance advice (ERA): a claim and what
 * the funder actually paid vs claimed, with the resulting shortfall. Produced by
 * the remittance import and used to reconcile claims + drive aged-claims reporting.
 */
@Entity('medical_aid_remittance_lines')
@Index(['remittanceId'])
@Index(['claimNumber'])
export class MedicalAidRemittanceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'remittance_id', type: 'uuid' })
  remittanceId: string;

  @ManyToOne(() => MedicalAidRemittance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'remittance_id' })
  remittance: MedicalAidRemittance;

  @Column({ name: 'claim_number', nullable: true })
  claimNumber: string;

  @Column({ name: 'external_claim_id', nullable: true })
  externalClaimId: string;

  // Resolved claim this line reconciled to (plain reference — no hard FK so a
  // deleted claim never blocks remittance history).
  @Column({ name: 'matched_claim_id', type: 'uuid', nullable: true })
  matchedClaimId: string;

  @Column({ name: 'claimed_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  claimedAmount: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: string;

  @Column({ name: 'shortfall_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shortfallAmount: string;

  // paid | short_paid | rejected | unmatched
  @Column({ name: 'status', default: 'unmatched' })
  status: string;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
