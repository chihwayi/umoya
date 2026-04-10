import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chw_tasks')
export class ChwTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assigned_to_chw_id', type: 'uuid' })
  assignedToChwId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'household_id', type: 'uuid', nullable: true })
  householdId: string | null;

  @Column({ name: 'task_type', length: 50 })
  taskType: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ length: 10, default: 'normal' })
  priority: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completion_notes', type: 'text', nullable: true })
  completionNotes: string | null;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
