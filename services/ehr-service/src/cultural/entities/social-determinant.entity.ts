import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('social_determinants')
export class SocialDeterminant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy: string | null;

  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' })
  assessmentDate: string;

  @Column({ name: 'food_insecurity', type: 'text', default: 'unknown' })
  foodInsecurity: string;

  @Column({ name: 'meals_per_day', type: 'int', nullable: true })
  mealsPerDay: number | null;

  @Column({ name: 'housing_type', type: 'text', nullable: true })
  housingType: string | null;

  @Column({ name: 'household_members', type: 'int', nullable: true })
  householdMembers: number | null;

  @Column({ name: 'water_source', type: 'text', nullable: true })
  waterSource: string | null;

  @Column({ name: 'sanitation', type: 'text', nullable: true })
  sanitation: string | null;

  @Column({ type: 'boolean', nullable: true })
  electricity: boolean | null;

  @Column({ name: 'household_income_usd_month', type: 'decimal', precision: 8, scale: 2, nullable: true })
  householdIncomeUsdMonth: number | null;

  @Column({ name: 'employment_status', type: 'text', nullable: true })
  employmentStatus: string | null;

  @Column({ name: 'social_grant_recipient', type: 'boolean', default: false })
  socialGrantRecipient: boolean;

  @Column({ name: 'social_grant_types', type: 'jsonb', default: () => "'[]'" })
  socialGrantTypes: string[];

  @Column({ name: 'education_level', type: 'text', nullable: true })
  educationLevel: string | null;

  @Column({ type: 'text', nullable: true })
  literacy: string | null;

  @Column({ name: 'gbv_screen_positive', type: 'boolean', nullable: true })
  gbvScreenPositive: boolean | null;

  @Column({ name: 'gbv_screen_date', type: 'date', nullable: true })
  gbvScreenDate: string | null;

  @Column({ name: 'child_protection_concern', type: 'boolean', default: false })
  childProtectionConcern: boolean;

  @Column({ name: 'extended_family_support', type: 'text', nullable: true })
  extendedFamilySupport: string | null;

  @Column({ name: 'community_group_member', type: 'boolean', default: false })
  communityGroupMember: boolean;

  @Column({ name: 'community_group_types', type: 'jsonb', default: () => "'[]'" })
  communityGroupTypes: string[];

  @Column({ name: 'sdoh_risk_score', type: 'int', nullable: true })
  sdohRiskScore: number | null;

  @Column({ name: 'sdoh_risk_level', type: 'text', nullable: true })
  sdohRiskLevel: string | null;

  @Column({ name: 'social_worker_referral_needed', type: 'boolean', default: false })
  socialWorkerReferralNeeded: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
