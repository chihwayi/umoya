import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('cervical_treatments')
export class CervicalTreatment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'screening_id', type: 'uuid', nullable: true })
  screeningId: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'treated_by', type: 'uuid' })
  treatedBy: string;

  @Column({ name: 'treated_at', type: 'timestamptz', default: () => 'NOW()' })
  treatedAt: Date;

  @Column({ length: 30 })
  method: string;

  @Column({ length: 30, nullable: true })
  outcome: string | null;

  @Column({ name: 'referral_reason', type: 'text', nullable: true })
  referralReason: string | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
