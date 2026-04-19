import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'cbhi_households' })
export class CbhiHousehold {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'household_id', unique: true }) householdId: string;

  @Column({ name: 'scheme_id' }) schemeId: string;

  @Column({ name: 'scheme_name' }) schemeName: string;

  @Column({ name: 'head_of_household_patient_id', type: 'uuid', nullable: true }) headOfHouseholdPatientId: string | null;

  @Column({ name: 'household_name' }) householdName: string;

  @Column({ name: 'village', nullable: true }) village: string | null;

  @Column({ name: 'ward', nullable: true }) ward: string | null;

  @Column({ name: 'district', nullable: true }) district: string | null;

  @Column({ name: 'membership_status', default: 'active' }) membershipStatus: string;

  @Column({ name: 'membership_start_date', type: 'date' }) membershipStartDate: string;

  @Column({ name: 'membership_expiry_date', type: 'date', nullable: true }) membershipExpiryDate: string | null;

  @Column({ name: 'member_count', type: 'int', default: 1 }) memberCount: number;

  @Column({ name: 'annual_premium_amount', type: 'numeric', precision: 10, scale: 2, nullable: true }) annualPremiumAmount: number | null;

  @Column({ name: 'premium_currency', default: 'USD' }) premiumCurrency: string;

  @Column({ name: 'premium_frequency', default: 'annual' }) premiumFrequency: string;

  @Column({ name: 'indigent_status', default: false }) indigentStatus: boolean;

  @Column({ name: 'indigent_certified_by', nullable: true }) indigentCertifiedBy: string | null;

  @Column({ name: 'indigent_certification_date', type: 'date', nullable: true }) indigentCertificationDate: string | null;

  @Column({ name: 'waiver_type', nullable: true }) waiverType: string | null;

  @Column({ name: 'waiver_percentage', type: 'numeric', precision: 5, scale: 2, nullable: true }) waiverPercentage: number | null;

  @Column({ name: 'waiver_sponsor', nullable: true }) waiverSponsor: string | null;

  @Column({ name: 'waiver_expiry_date', type: 'date', nullable: true }) waiverExpiryDate: string | null;

  @Column({ name: 'phone', nullable: true }) phone: string | null;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true }) registeredBy: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
