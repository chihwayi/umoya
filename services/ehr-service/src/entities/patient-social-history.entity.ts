import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type HistoryType = 'smoking' | 'alcohol' | 'drug_use' | 'occupation' | 'exercise' | 'diet' | 'travel' | 'sexual_history' | 'other';

@Entity('patient_social_history')
export class PatientSocialHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'history_type', type: 'varchar', length: 50 })
  historyType: HistoryType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  quantity?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

