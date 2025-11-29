import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DiabetesRegistry } from './diabetes-registry.entity';
import { Patient } from './patient.entity';

export type DiabetesEducationSessionType = 'individual' | 'group' | 'online' | 'phone' | 'other';
export type DiabetesEducationCompletionStatus = 'completed' | 'partial' | 'missed' | 'rescheduled';

@Entity('diabetes_education_sessions')
export class DiabetesEducationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diabetes_registry_id', type: 'uuid' })
  diabetesRegistryId: string;

  @ManyToOne(() => DiabetesRegistry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diabetes_registry_id' })
  registry: DiabetesRegistry;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'session_date', type: 'date' })
  sessionDate: Date;

  @Column({ name: 'session_type', type: 'varchar', length: 30 })
  sessionType: DiabetesEducationSessionType;

  @Column({ name: 'topics_covered', type: 'text', array: true, default: () => "'{}'" })
  topicsCovered?: string[];

  @Column({ name: 'educator_id', type: 'uuid', nullable: true })
  educatorId?: string;

  @Column({ name: 'patient_attendance', type: 'boolean', default: true })
  patientAttendance: boolean;

  @Column({ name: 'completion_status', type: 'varchar', length: 30, default: 'completed' })
  completionStatus: DiabetesEducationCompletionStatus;

  @Column({ name: 'assessment_score', type: 'int', nullable: true })
  assessmentScore?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




