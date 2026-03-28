import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('crisis_events')
export class CrisisEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'reported_by', type: 'uuid' })
  reportedBy: string;

  @Column({ name: 'event_date', type: 'timestamptz', default: () => 'now()' })
  eventDate: Date;

  @Column({ name: 'crisis_type', type: 'text' })
  crisisType: string;

  @Column({ name: 'ideation_type', type: 'text', nullable: true })
  ideationType: string | null;

  @Column({ type: 'text', nullable: true })
  lethality: string | null;

  @Column({ name: 'means_access', type: 'boolean', default: false })
  meansAccess: boolean;

  @Column({ name: 'prior_attempts', type: 'int', default: 0 })
  priorAttempts: number;

  @Column({ name: 'protective_factors', type: 'jsonb', default: [] })
  protectiveFactors: any[];

  @Column({ type: 'text', nullable: true })
  intervention: string | null;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ name: 'follow_up_plan', type: 'text', nullable: true })
  followUpPlan: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
