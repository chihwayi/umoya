import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export type NurseCopilotTaskEventStatus = 'completed' | 'in_progress';

@Entity('nurse_copilot_task_events')
export class NurseCopilotTaskEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'task_id', type: 'varchar', length: 120 })
  taskId: string;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: NurseCopilotTaskEventStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, default: 'nurse_worklist' })
  source: string;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
