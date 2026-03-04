import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export type NurseHandoffWorkflowStatus = 'draft' | 'finalized' | 'reviewed' | 'shared';

@Entity('nurse_handoff_workflow_state')
export class NurseHandoffWorkflowState {
  @PrimaryColumn({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @OneToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: NurseHandoffWorkflowStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'finalized_by' })
  finalizedByUser?: User | null;

  @Column({ name: 'finalized_by', type: 'uuid', nullable: true })
  finalizedBy?: string | null;

  @Column({ name: 'finalized_at', type: 'timestamp with time zone', nullable: true })
  finalizedAt?: Date | null;

  @Column({ name: 'finalized_summary_preview', type: 'text', nullable: true })
  finalizedSummaryPreview?: string | null;

  @Column({ name: 'finalize_reason', type: 'text', nullable: true })
  finalizeReason?: string | null;

  @Column({ name: 'finalize_context', type: 'jsonb', nullable: true })
  finalizeContext?: Record<string, any> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser?: User | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'reviewer_name', type: 'varchar', length: 255, nullable: true })
  reviewerName?: string | null;

  @Column({ name: 'reviewer_role', type: 'varchar', length: 100, nullable: true })
  reviewerRole?: string | null;

  @Column({ name: 'review_reason', type: 'text', nullable: true })
  reviewReason?: string | null;

  @Column({ name: 'review_context', type: 'jsonb', nullable: true })
  reviewContext?: Record<string, any> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shared_by' })
  sharedByUser?: User | null;

  @Column({ name: 'shared_by', type: 'uuid', nullable: true })
  sharedBy?: string | null;

  @Column({ name: 'shared_at', type: 'timestamp with time zone', nullable: true })
  sharedAt?: Date | null;

  @Column({ name: 'share_channel', type: 'varchar', length: 50, nullable: true })
  shareChannel?: string | null;

  @Column({ name: 'share_recipient', type: 'varchar', length: 255, nullable: true })
  shareRecipient?: string | null;

  @Column({ name: 'share_reason', type: 'text', nullable: true })
  shareReason?: string | null;

  @Column({ name: 'share_context', type: 'jsonb', nullable: true })
  shareContext?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
