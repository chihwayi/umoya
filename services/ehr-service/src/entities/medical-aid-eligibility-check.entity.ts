import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('medical_aid_eligibility_checks')
export class MedicalAidEligibilityCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ name: 'provider_id', type: 'uuid', nullable: true })
  providerId: string | null;

  @Column({ name: 'member_number', length: 100, nullable: true })
  memberNumber: string | null;

  @Column({ name: 'policy_number', length: 100, nullable: true })
  policyNumber: string | null;

  @Column({ length: 30, default: 'pending' })
  status: 'pending' | 'eligible' | 'ineligible' | 'error';

  @Column({ name: 'request_payload', type: 'jsonb', default: () => `'{}'::jsonb` })
  requestPayload: Record<string, any>;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => `'{}'::jsonb` })
  responsePayload: Record<string, any>;

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt: Date | null;

  @Column({ name: 'checked_by', type: 'uuid', nullable: true })
  checkedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

