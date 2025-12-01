import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PatientHealthGoal } from './patient-health-goal.entity';
import { Patient } from './patient.entity';

export enum ProgressSource {
  MANUAL = 'manual',
  VITALS = 'vitals',
  LAB_RESULT = 'lab_result',
  PATIENT_PORTAL = 'patient_portal',
  WEARABLE = 'wearable',
  AUTO = 'auto',
}

@Entity('goal_progress_logs')
@Index(['goalId', 'loggedDate'], { unique: true })
export class GoalProgressLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  goalId: string;

  @ManyToOne(() => PatientHealthGoal)
  @JoinColumn({ name: 'goal_id' })
  goal: PatientHealthGoal;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  loggedValue: number;

  @Column({ type: 'date' })
  loggedDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: ProgressSource;

  @Column({ type: 'uuid', nullable: true })
  sourceId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

