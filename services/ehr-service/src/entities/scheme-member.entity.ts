import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('scheme_members')
export class SchemeMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'nhif_scheme_id', type: 'uuid', nullable: true })
  nhifSchemeId: string | null;

  @Column({ name: 'member_number', length: 50 })
  memberNumber: string;

  @Column({ name: 'principal_member_number', length: 50, nullable: true })
  principalMemberNumber: string | null;

  @Column({ name: 'relationship', length: 30, nullable: true })
  relationship: string | null;

  @Column({ name: 'enrollment_date', type: 'date' })
  enrollmentDate: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'status', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'contribution_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  contributionAmount: number | null;

  @Column({ name: 'contribution_frequency', length: 20, nullable: true })
  contributionFrequency: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
