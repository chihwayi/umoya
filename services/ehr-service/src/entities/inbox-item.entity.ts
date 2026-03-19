import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Patient } from './patient.entity';

/**
 * A single item in a provider's AI-triaged smart inbox.
 * Populated by InboxTriageService whenever a lab result, imaging result,
 * patient message, or critical alert is created.
 *
 * Provisioned in Sprint 65 — provision-sprint65-smart-inbox.ts
 */
@Entity('inbox_items')
export class InboxItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  /** lab_result | imaging_result | patient_message | critical_alert | task | referral_response */
  @Column({ name: 'source_type', length: 50 })
  sourceType: string;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId?: string;

  @Column({ length: 255 })
  title: string;

  /** First 200 chars of the original content */
  @Column({ type: 'text', nullable: true })
  preview?: string;

  /** critical | urgent | routine | informational */
  @Column({ name: 'ai_priority', length: 20, default: 'routine' })
  aiPriority: string = 'routine';

  @Column({ name: 'ai_priority_reason', type: 'text', nullable: true })
  aiPriorityReason?: string;

  @Column({ name: 'ai_draft_reply', type: 'text', nullable: true })
  aiDraftReply?: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'is_actioned', type: 'boolean', default: false })
  isActioned: boolean;

  @Column({ name: 'actioned_at', type: 'timestamptz', nullable: true })
  actionedAt?: Date;

  @Column({ name: 'due_by', type: 'timestamptz', nullable: true })
  dueBy?: Date;

  /** 0–100 urgency score from CDSS */
  @Column({ name: 'triage_score', type: 'int', nullable: true })
  triageScore?: number;

  @Column({ name: 'triage_model', length: 60, nullable: true })
  triageModel?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
