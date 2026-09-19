import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  NURSE_ACCOUNTS = 'nurse_accounts',
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  LAB_TECH = 'lab_tech',
  RADIOLOGIST = 'radiologist',
  ACCOUNTS = 'accounts',
  STORE_MANAGER = 'store_manager',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  phone: string;

  // select: false — these three columns must never come back on a plain
  // find()/findOne()/query-builder select, since User is joined into dozens
  // of unrelated API responses (appointments, vitals, lab orders, charges...)
  // across the codebase for display purposes only. Call sites that
  // genuinely need to read one of these (auth.service.ts) must opt back in
  // explicitly via .addSelect('user.passwordHash') on a query builder.
  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  @Column()
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'license_number', nullable: true })
  licenseNumber: string;

  // Statutory registration council for the prescriber (e.g. MDPCZ, PCZ, NCZ).
  @Column({ name: 'registration_council', nullable: true })
  registrationCouncil: string;

  @Column({ nullable: true })
  specialization: string;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date;

  @Column({ name: 'password_changed_at', nullable: true })
  passwordChangedAt: Date;

  @Column({ name: 'two_factor_secret', length: 64, nullable: true, select: false })
  twoFactorSecret: string;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;
  @Column({ name: 'fcm_token', type: 'text', nullable: true, select: false })
  fcmToken?: string;

  @Column({ name: 'on_call', type: 'boolean', default: false })
  onCall: boolean = false;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
