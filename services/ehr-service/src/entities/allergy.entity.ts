import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('allergies')
export class Allergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column()
  allergen: string;

  @Column({ type: 'text', nullable: true })
  reaction: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  severity: 'mild' | 'moderate' | 'severe';

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User;
}


