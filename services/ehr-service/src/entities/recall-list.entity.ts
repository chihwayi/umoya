import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('recall_lists')
export class RecallList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'jsonb' })
  criteria: Record<string, any>;

  @Column({ name: 'patient_count', default: 0 })
  patientCount: number;

  @Column({ name: 'last_generated_at', type: 'timestamp with time zone', nullable: true })
  lastGeneratedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
