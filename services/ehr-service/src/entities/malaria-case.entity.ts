import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('malaria_cases')
export class MalariaCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'registered_by', type: 'uuid' })
  registeredBy: string;

  @Column({ name: 'registered_at', type: 'timestamptz', default: () => 'now()' })
  registeredAt: Date;

  @Column({ name: 'case_type', type: 'text' })
  caseType: string;

  @Column({ type: 'text', nullable: true })
  species: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 1, nullable: true })
  haemoglobin: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  parasitaemia: number | null;

  @Column({ type: 'int', nullable: true })
  gcs: number | null;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ name: 'outcome_date', type: 'date', nullable: true })
  outcomeDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
