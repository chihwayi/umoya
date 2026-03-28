import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, BeforeInsert, ManyToOne, JoinColumn,
} from 'typeorm';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_number', unique: true })
  patientNumber: string;

  // ── Core identity ─────────────────────────────────────────────────────────
  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: Date;

  @Column()
  gender: string;

  @Column({ name: 'id_number', unique: true, nullable: true })
  nationalId: string;

  // ── Contact ───────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  // ── Emergency contact ─────────────────────────────────────────────────────
  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  // ── Medical aid ───────────────────────────────────────────────────────────
  @Column({ name: 'medical_aid_name', nullable: true })
  medicalAidProvider: string;

  @Column({ name: 'medical_aid_number', nullable: true })
  medicalAidNumber: string;

  // ── Clinical baseline ──────────────────────────────────────────────────────
  @Column({ name: 'blood_type', nullable: true })
  bloodType: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ name: 'chronic_conditions', type: 'text', nullable: true })
  medicalHistory: string;

  // ── Extended demographics (Sprint 60) ─────────────────────────────────────
  @Column({ nullable: true, length: 100 })
  ethnicity?: string;

  @Column({ nullable: true, length: 100 })
  race?: string;

  /** ISO 639-1 language code, e.g. 'en', 'sn' (Shona), 'nd' (Ndebele) */
  @Column({ name: 'preferred_language', length: 10, default: 'en' })
  preferredLanguage: string = 'en';

  @Column({ nullable: true, length: 100 })
  nationality?: string;

  @Column({ name: 'country_of_birth', nullable: true, length: 100 })
  countryOfBirth?: string;

  @Column({ nullable: true, length: 100 })
  religion?: string;

  @Column({ name: 'interpreter_required', default: false })
  interpreterRequired: boolean = false;

  // ── Socioeconomic context ─────────────────────────────────────────────────
  @Column({ name: 'marital_status', nullable: true, length: 30 })
  maritalStatus?: string;

  @Column({ nullable: true, length: 150 })
  occupation?: string;

  @Column({ name: 'employment_status', nullable: true, length: 50 })
  employmentStatus?: string;

  @Column({ name: 'education_level', nullable: true, length: 50 })
  educationLevel?: string;

  // ── Disability ────────────────────────────────────────────────────────────
  @Column({ name: 'disability_status', default: false })
  disabilityStatus: boolean = false;

  @Column({ name: 'disability_type', nullable: true, length: 200 })
  disabilityType?: string;

  // ── Preferred provider ────────────────────────────────────────────────────
  @Column({ name: 'preferred_provider_id', type: 'uuid', nullable: true })
  preferredProviderId?: string;

  // ── Substance use — structured for AI risk models ─────────────────────────
  /** never | former | current */
  @Column({ name: 'smoking_status', nullable: true, length: 20 })
  smokingStatus?: string;

  @Column({ name: 'pack_years', type: 'decimal', precision: 5, scale: 1, nullable: true })
  packYears?: number;

  /** none | occasional | moderate | heavy */
  @Column({ name: 'alcohol_use', nullable: true, length: 20 })
  alcoholUse?: string;

  /** AUDIT-C score (0–12) */
  @Column({ name: 'audit_c_score', type: 'int', nullable: true })
  auditCScore?: number;

  @Column({ name: 'substance_use', default: false })
  substanceUse: boolean = false;

  @Column({ name: 'substance_use_details', type: 'text', nullable: true })
  substanceUseDetails?: string;

  // ── Reproductive health ────────────────────────────────────────────────────
  /** not_pregnant | pregnant | postpartum | unknown */
  @Column({ name: 'pregnancy_status', nullable: true, length: 30 })
  pregnancyStatus?: string;

  @Column({ name: 'gestational_age_weeks', type: 'int', nullable: true })
  gestationalAgeWeeks?: number;

  // ── Advance care planning ─────────────────────────────────────────────────
  @Column({ name: 'advance_directive_on_file', default: false })
  advanceDirectiveOnFile: boolean = false;

  // ── Status & portal ───────────────────────────────────────────────────────
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'portal_password_hash', nullable: true })
  portalPasswordHash?: string;

  @Column({ name: 'portal_access_enabled', default: false })
  portalAccessEnabled: boolean;

  @Column({ name: 'portal_registered_at', type: 'timestamptz', nullable: true })
  portalRegisteredAt?: Date;

  @Column({ name: 'portal_last_login', type: 'timestamptz', nullable: true })
  portalLastLogin?: Date;

  @Column({ name: 'portal_email_verified', default: false })
  portalEmailVerified: boolean;

  @Column({ name: 'portal_email_verification_token', nullable: true })
  portalEmailVerificationToken?: string;

  @Column({ name: 'portal_password_reset_token', nullable: true })
  portalPasswordResetToken?: string;

  @Column({ name: 'portal_password_reset_expires', type: 'timestamptz', nullable: true })
  portalPasswordResetExpires?: Date;
  @Column({ name: 'insurance_number', type: 'text', nullable: true })
  insuranceNumber?: string;

  @Column({ name: 'insurance_provider', type: 'text', nullable: true })
  insuranceProvider?: string;

  @Column({ name: 'medical_aid_plan', type: 'varchar', length: 100, nullable: true })
  medicalAidPlan?: string;

  @Column({ name: 'next_of_kin_name', type: 'text', nullable: true })
  nextOfKinName?: string;

  @Column({ name: 'next_of_kin_phone', type: 'text', nullable: true })
  nextOfKinPhone?: string;

  @Column({ name: 'next_of_kin_relationship', type: 'text', nullable: true })
  nextOfKinRelationship?: string;

  @Column({ name: 'sdoh_education', type: 'text', nullable: true })
  sdohEducation?: string;

  @Column({ name: 'sdoh_employment', type: 'text', nullable: true })
  sdohEmployment?: string;

  @Column({ name: 'sdoh_food_security', type: 'text', nullable: true })
  sdohFoodSecurity?: string;

  @Column({ name: 'sdoh_housing', type: 'text', nullable: true })
  sdohHousing?: string;

  @Column({ name: 'sdoh_screened_at', type: 'timestamptz', nullable: true })
  sdohScreenedAt?: Date;

  @Column({ name: 'sdoh_social_support', type: 'text', nullable: true })
  sdohSocialSupport?: string;

  @Column({ name: 'sdoh_transport', type: 'text', nullable: true })
  sdohTransport?: string;

  @Column({ name: 'secondary_language', type: 'text', nullable: true })
  secondaryLanguage?: string;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Computed helpers ──────────────────────────────────────────────────────
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get age(): number {
    const today    = new Date();
    const birth    = new Date(this.dateOfBirth);
    let   age      = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  get mrn(): string {
    return this.patientNumber;
  }
}
