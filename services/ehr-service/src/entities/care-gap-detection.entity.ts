import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { NurseTask } from './nurse-task.entity';

/**
 * Records a care gap identified by the CDSS or a clinician for a patient.
 * Each detection can be linked to a NurseTask so it becomes actionable.
 *
 * Provisioned in Sprint 62 — provision-sprint62-proactive-care-gaps.ts
 */
@Entity('care_gap_detections')
export class CareGapDetection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' })
  detectedAt: Date;

  /** cdss | manual */
  @Column({ name: 'detected_by', length: 20, default: 'cdss' })
  detectedBy: string = 'cdss';

  /** e.g. mammogram_overdue | hba1c_missing | bp_uncontrolled */
  @Column({ name: 'gap_type', length: 100 })
  gapType: string;

  @Column({ name: 'gap_description', type: 'text' })
  gapDescription: string;

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction?: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  /** low | medium | high | urgent */
  @Column({ length: 20, default: 'medium' })
  priority: string = 'medium';

  /** ICD-10/11 code related to this care gap */
  @Column({ name: 'icd_code', length: 20, nullable: true })
  icdCode?: string;

  @Column({ name: 'linked_task_id', type: 'uuid', nullable: true })
  linkedTaskId?: string;

  @ManyToOne(() => NurseTask, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_task_id' })
  linkedTask?: NurseTask;

  /** open | resolved | deferred | patient_declined */
  @Column({ length: 30, default: 'open' })
  status: string = 'open';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
