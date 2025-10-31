import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  code: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'resolved';

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: Date | null;

  @Column({ name: 'resolved_date', type: 'date', nullable: true })
  resolvedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


