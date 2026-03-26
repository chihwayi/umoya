import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('prior_authorization_drafts')
@Index('idx_prior_authorization_drafts_claim_id', ['claimId'])
@Index('idx_prior_authorization_drafts_patient_id', ['patientId'])
@Index('idx_prior_authorization_drafts_status', ['status'])
export class PriorAuthorizationDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'medical_aid_name', type: 'varchar', length: 150 })
  medicalAidName: string;

  @Column({ name: 'member_number', type: 'varchar', length: 100, nullable: true })
  memberNumber: string | null;

  @Column({ name: 'request_type', type: 'varchar', length: 60, default: 'consultation' })
  requestType: string;

  @Column({ name: 'requested_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  requestedAmount: number | null;

  @Column({ name: 'diagnosis_summary', type: 'text', nullable: true })
  diagnosisSummary: string | null;

  @Column({ name: 'procedure_summary', type: 'text', nullable: true })
  procedureSummary: string | null;

  @Column({ name: 'justification', type: 'text', nullable: true })
  justification: string | null;

  @Column({ name: 'supporting_documents', type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingDocuments: Array<Record<string, any>>;

  @Column({ name: 'draft_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  draftData: Record<string, any>;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
