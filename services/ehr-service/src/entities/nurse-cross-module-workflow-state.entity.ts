import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export type NurseCrossModuleWorkflowStatus = 'pending' | 'acknowledged' | 'completed';

@Entity('nurse_cross_module_workflow_state')
export class NurseCrossModuleWorkflowState {
  @PrimaryColumn({ name: 'workflow_key', type: 'varchar', length: 160 })
  workflowKey: string;

  @Column({ type: 'varchar', length: 40 })
  module: string;

  @Column({ name: 'item_type', type: 'varchar', length: 80 })
  itemType: string;

  @Column({ name: 'source_record_id', type: 'varchar', length: 160, nullable: true })
  sourceRecordId?: string | null;

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId?: string | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string | null;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: NurseCrossModuleWorkflowStatus;

  @Column({ name: 'destination_role', type: 'varchar', length: 80, nullable: true })
  destinationRole?: string | null;

  @Column({ name: 'destination_service', type: 'varchar', length: 120, nullable: true })
  destinationService?: string | null;

  @Column({ name: 'destination_specialty', type: 'varchar', length: 160, nullable: true })
  destinationSpecialty?: string | null;

  @Column({ name: 'destination_user_id', type: 'uuid', nullable: true })
  destinationUserId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_user_id' })
  destinationUser?: User | null;

  @Column({ name: 'destination_facility_id', type: 'uuid', nullable: true })
  destinationFacilityId?: string | null;

  @Column({ name: 'destination_facility_name', type: 'varchar', length: 255, nullable: true })
  destinationFacilityName?: string | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedByUser?: User | null;

  @Column({ name: 'acknowledged_at', type: 'timestamp with time zone', nullable: true })
  acknowledgedAt?: Date | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completed_by' })
  completedByUser?: User | null;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
