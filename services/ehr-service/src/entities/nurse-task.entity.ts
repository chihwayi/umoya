import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

/**
 * A discrete task assigned to a nurse, generated either by the AI (care gap
 * scheduler) or manually by a clinician.
 *
 * Provisioned in Sprint 62 — provision-sprint62-proactive-care-gaps.ts
 */
@Entity('nurse_tasks')
export class NurseTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignedToUser?: User;

  /** True when the AI scheduler created this task automatically */
  @Column({ name: 'assigned_by_system', default: false })
  assignedBySystem: boolean = false;

  /**
   * One of: care_gap | follow_up | order_reminder |
   *         result_review | medication_check
   */
  @Column({ name: 'task_type', length: 50 })
  taskType: string;

  /** low | medium | high | urgent */
  @Column({ length: 20, default: 'medium' })
  priority: string = 'medium';

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  /** cdss | manual | protocol */
  @Column({ name: 'source_type', length: 30, nullable: true })
  sourceType?: string;

  /** FK to the originating entity (e.g. care_gap_detection.id) */
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId?: string;

  /** pending | in_progress | completed | cancelled */
  @Column({ length: 30, default: 'pending' })
  status: string = 'pending';

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completed_by' })
  completedByUser?: User;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'completion_notes', type: 'text', nullable: true })
  completionNotes?: string;

  /** Set when a nurse opens/views this task notification — prevents it from re-appearing as "new" */
  @Column({ name: 'viewed_at', type: 'timestamptz', nullable: true })
  viewedAt?: Date;

  @Column({ name: 'viewed_by', type: 'uuid', nullable: true })
  viewedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
