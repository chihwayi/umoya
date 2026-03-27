import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('financial_hardship_referrals')
export class FinancialHardshipReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId: string | null;

  @Column({ name: 'trigger_reason', type: 'varchar', length: 100 })
  triggerReason: string;

  @Column({ name: 'household_size', type: 'int', nullable: true })
  householdSize: number | null;

  @Column({ name: 'estimated_income_band', type: 'varchar', length: 30, nullable: true })
  estimatedIncomeBand: string | null;

  @Column({ name: 'programs_matched', type: 'jsonb', default: [] })
  programsMatched: Array<{ name: string; code: string; eligibility: string; url: string }>;

  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending' })
  status: 'pending' | 'contacted' | 'enrolled' | 'ineligible' | 'declined';

  @Column({ name: 'ai_recommendation', type: 'text', nullable: true })
  aiRecommendation: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
