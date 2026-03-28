import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('psychotropic_medications')
export class PsychotropicMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'prescribed_by', type: 'uuid' })
  prescribedBy: string;

  @Column({ name: 'drug_name', type: 'text' })
  drugName: string;

  @Column({ name: 'drug_class', type: 'text' })
  drugClass: string;

  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true })
  doseMg: number | null;

  @Column({ type: 'text', nullable: true })
  frequency: string | null;

  @Column({ type: 'text', default: 'oral' })
  route: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', nullable: true })
  indication: string | null;

  @Column({ name: 'monitoring_required', type: 'jsonb', default: [] })
  monitoringRequired: any[];

  @Column({ name: 'last_level_date', type: 'date', nullable: true })
  lastLevelDate: string | null;

  @Column({ name: 'last_level_value', type: 'numeric', precision: 8, scale: 2, nullable: true })
  lastLevelValue: number | null;

  @Column({ name: 'last_level_unit', type: 'text', nullable: true })
  lastLevelUnit: string | null;

  @Column({ name: 'adverse_effects', type: 'text', nullable: true })
  adverseEffects: string | null;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
