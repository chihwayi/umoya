import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { PatientHealthGoal } from './patient-health-goal.entity';

export enum AchievementType {
  GOAL_COMPLETED = 'goal_completed',
  MILESTONE_REACHED = 'milestone_reached',
  STREAK = 'streak',
  CONSISTENCY = 'consistency',
  IMPROVEMENT = 'improvement',
  ENGAGEMENT = 'engagement',
  SPECIAL = 'special',
}

@Entity('patient_achievements')
export class PatientAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 100 })
  achievementType: AchievementType;

  @Column({ type: 'varchar', length: 255 })
  achievementName: string;

  @Column({ type: 'text', nullable: true })
  achievementDescription: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  badgeIcon: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  badgeColor: string;

  @Column({ type: 'integer', default: 0 })
  points: number;

  @Column({ type: 'uuid', nullable: true })
  goalId: string;

  @ManyToOne(() => PatientHealthGoal, { nullable: true })
  @JoinColumn({ name: 'goal_id' })
  goal: PatientHealthGoal;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  milestonePercentage: number;

  @Column({ type: 'integer', nullable: true })
  streakDays: number;

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  earnedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

