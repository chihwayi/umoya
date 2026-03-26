import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('insurance_eligibility_checks')
export class InsuranceEligibilityCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 150, nullable: true })
  providerName?: string | null;

  @Column({ name: 'member_number', type: 'varchar', length: 100, nullable: true })
  memberNumber?: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 120, nullable: true })
  planName?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'information_required' })
  status: string;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence?: number | null;

  @Column({ name: 'coverage_flags', type: 'jsonb', default: () => "'[]'::jsonb" })
  coverageFlags: string[];

  @Column({ name: 'request_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestPayload: Record<string, any>;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  responsePayload: Record<string, any>;

  @Column({ name: 'checked_at', type: 'timestamptz', default: () => 'NOW()' })
  checkedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
