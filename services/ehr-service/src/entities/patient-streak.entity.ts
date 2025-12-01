import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Patient } from './patient.entity';

export enum StreakType {
  VITALS_SUBMISSION = 'vitals_submission',
  MEDICATION_ADHERENCE = 'medication_adherence',
  EXERCISE = 'exercise',
  GOAL_PROGRESS = 'goal_progress',
  PORTAL_LOGIN = 'portal_login',
}

@Entity('patient_streaks')
@Index(['patientId', 'streakType'], { unique: true })
export class PatientStreak {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 100 })
  streakType: StreakType;

  @Column({ type: 'integer', default: 0 })
  currentStreakDays: number;

  @Column({ type: 'integer', default: 0 })
  longestStreakDays: number;

  @Column({ type: 'date', nullable: true })
  lastActivityDate: Date;

  @Column({ type: 'date', nullable: true })
  streakStartDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

