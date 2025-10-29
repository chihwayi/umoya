import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity({ name: 'vitals' })
export class Vitals {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'blood_pressure', type: 'varchar', length: 20, nullable: true })
  bloodPressure?: string;

  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate?: number;

  @Column({ name: 'temperature', type: 'decimal', precision: 4, scale: 2, nullable: true })
  temperature?: number;

  @Column({ name: 'oxygen_saturation', type: 'int', nullable: true })
  oxygenSaturation?: number;

  @Column({ name: 'respiratory_rate', type: 'int', nullable: true })
  respiratoryRate?: number;

  @Column({ name: 'weight', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight?: number;

  @Column({ name: 'height', type: 'decimal', precision: 5, scale: 2, nullable: true })
  height?: number;

  @Column({ name: 'bmi', type: 'decimal', precision: 4, scale: 2, nullable: true })
  bmi?: number;

  @Column({ name: 'pain_level', type: 'int', nullable: true })
  painLevel?: number;

  @Column({ name: 'blood_glucose', type: 'decimal', precision: 5, scale: 2, nullable: true })
  bloodGlucose?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}


