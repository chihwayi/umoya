import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('malaria_treatments')
export class MalariaTreatment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'malaria_case_id', type: 'uuid' })
  malariaCaseId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'prescribed_by', type: 'uuid' })
  prescribedBy: string;

  @Column({ type: 'text' })
  regimen: string;

  @Column({ name: 'regimen_label', type: 'text', nullable: true })
  regimenLabel: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ name: 'dose_mg_per_kg', type: 'numeric', precision: 6, scale: 2, nullable: true })
  doseMgPerKg: number | null;

  @Column({ name: 'act_lot_number', type: 'text', nullable: true })
  actLotNumber: string | null;

  @Column({ name: 'day_one_observed', type: 'boolean', default: false })
  dayOneObserved: boolean;

  @Column({ name: 'follow_up_day3', type: 'jsonb', nullable: true })
  followUpDay3: Record<string, any> | null;

  @Column({ name: 'follow_up_day7', type: 'jsonb', nullable: true })
  followUpDay7: Record<string, any> | null;

  @Column({ name: 'follow_up_day14', type: 'jsonb', nullable: true })
  followUpDay14: Record<string, any> | null;

  @Column({ name: 'follow_up_day28', type: 'jsonb', nullable: true })
  followUpDay28: Record<string, any> | null;

  @Column({ name: 'treatment_outcome', type: 'text', nullable: true })
  treatmentOutcome: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
