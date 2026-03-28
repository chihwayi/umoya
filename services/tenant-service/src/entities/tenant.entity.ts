import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TenantStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled'
}

export enum SubscriptionTier {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export type SubscriptionMode = 'demo' | 'paid';
export type SubscriptionState = 'demo' | 'active' | 'grace' | 'suspended' | 'expired';
export type PackagePreset = 'full_ehr' | 'claims_only';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clinicName: string;

  @Column({ unique: true })
  subdomain: string;

  @Column()
  databaseName: string;

  @Column({ nullable: true })
  connectionString: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.BASIC
  })
  subscriptionTier: SubscriptionTier;

  @Column({ default: 'paid' })
  subscriptionMode: SubscriptionMode;

  @Column({ default: 'full_ehr' })
  packagePreset: PackagePreset;

  @Column({ default: 'active' })
  subscriptionState: SubscriptionState;

  @Column({ nullable: true })
  packageName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  enabledModules: string[];

  @Column({ type: 'timestamptz', nullable: true })
  billingEndsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  demoExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  graceEndsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  autoDeleteAt: Date | null;

  @Column({ type: 'int', default: 5 })
  suspensionWarningDays: number;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.PENDING
  })
  status: TenantStatus;

  @Column()
  contactEmail: string;

  @Column()
  contactPhone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ default: 'Zimbabwe' })
  country: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  featureFlags: Record<string, boolean>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
