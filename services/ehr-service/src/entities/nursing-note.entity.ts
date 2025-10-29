import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'nursing_notes' })
export class NursingNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'note_type', type: 'varchar', length: 50 })
  noteType: 'general' | 'assessment' | 'intervention' | 'evaluation';

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'vital_signs', type: 'text', nullable: true })
  vitalSigns?: string;

  @Column({ type: 'text', nullable: true })
  medications?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ type: 'text', nullable: true })
  interventions?: string;

  @Column({ type: 'text', nullable: true })
  outcomes?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}


