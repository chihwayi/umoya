import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('nhif_members')
export class NhifMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'scheme_code', type: 'text' })
  schemeCode: string;

  @Column({ name: 'membership_number', type: 'text' })
  membershipNumber: string;

  @Column({ name: 'national_id', type: 'text', nullable: true })
  nationalId: string | null;

  @Column({ name: 'principal_member_id', type: 'uuid', nullable: true })
  principalMemberId: string | null;

  @Column({ name: 'is_principal', type: 'boolean', default: true })
  isPrincipal: boolean;

  @Column({ name: 'enrollment_date', type: 'date', nullable: true })
  enrollmentDate: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @Column({ name: 'monthly_contribution', type: 'numeric', precision: 10, scale: 2, nullable: true })
  monthlyContribution: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
