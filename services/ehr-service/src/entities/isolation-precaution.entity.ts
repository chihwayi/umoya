import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('isolation_precautions')
export class IsolationPrecaution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @Column({ name: 'isolation_type', length: 50 })
  isolationType: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ length: 255, nullable: true })
  organism: string;

  @Column({ name: 'infection_icd10', length: 10, nullable: true })
  infectionIcd10: string;

  @Column({ name: 'start_date', type: 'timestamptz', default: () => 'NOW()' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date;

  @Column({ name: 'room_number', length: 50, nullable: true })
  roomNumber: string;

  @Column({ name: 'bed_number', length: 50, nullable: true })
  bedNumber: string;

  @Column({ name: 'ppe_required', type: 'jsonb', default: [] })
  ppeRequired: string[];

  @Column({ length: 50, default: 'active' })
  status: string;

  @Column({ name: 'ordered_by', type: 'uuid' })
  orderedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordered_by' })
  orderedBy: User;

  @Column({ name: 'discontinued_by', type: 'uuid', nullable: true })
  discontinuedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'discontinued_by' })
  discontinuedBy: User;

  @Column({ name: 'discontinuation_reason', type: 'text', nullable: true })
  discontinuationReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




