import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum GoalType {
  WEIGHT_LOSS = 'weight_loss',
  WEIGHT_GAIN = 'weight_gain',
  BLOOD_PRESSURE = 'blood_pressure',
  BLOOD_GLUCOSE = 'blood_glucose',
  CHOLESTEROL = 'cholesterol',
  EXERCISE = 'exercise',
  MEDICATION_ADHERENCE = 'medication_adherence',
  SMOKING_CESSATION = 'smoking_cessation',
  ALCOHOL_REDUCTION = 'alcohol_reduction',
  DIET = 'diet',
  OTHER = 'other',
}

export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

@Entity('patient_health_goals')
export class PatientHealthGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 100 })
  goalType: GoalType;

  @Column({ type: 'varchar', length: 255 })
  goalName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  targetValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentValue: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  targetDate: Date;

  @Column({ type: 'varchar', length: 50, default: GoalStatus.ACTIVE })
  status: GoalStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 25 })
  milestonePercentage: number;

  @Column({ type: 'boolean', default: false })
  milestoneAchieved: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  milestoneAchievedAt: Date;

  @Column({ type: 'boolean', default: false })
  isAutoTracked: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingSource: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

