import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('immunization_schedules')
export class ImmunizationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_name', length: 255 })
  scheduleName: string;

  @Column({ name: 'vaccine_code', length: 20 })
  vaccineCode: string;

  @Column({ name: 'vaccine_name', length: 255 })
  vaccineName: string;

  @Column({ name: 'age_group', length: 50 })
  ageGroup: string;

  @Column({ name: 'minimum_age_months', nullable: true })
  minimumAgeMonths: number;

  @Column({ name: 'maximum_age_months', nullable: true })
  maximumAgeMonths: number;

  @Column({ name: 'dose_number' })
  doseNumber: number;

  @Column({ name: 'recommended_age_months', nullable: true })
  recommendedAgeMonths: number;

  @Column({ name: 'minimum_interval_days', nullable: true })
  minimumIntervalDays: number;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ name: 'schedule_type', length: 50, default: 'routine' })
  scheduleType: string;

  @Column({ type: 'jsonb', default: '[]' })
  contraindications: any[];

  @Column({ type: 'jsonb', default: '[]' })
  precautions: any[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'cdc_schedule_version', length: 20, nullable: true })
  cdcScheduleVersion: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'target_disease_snomed_codes', type: 'jsonb', default: '[]' })
  targetDiseaseSnomedCodes: any[];

  @Column({ name: 'contraindications_snomed', type: 'jsonb', default: '[]' })
  contraindicationsSnomed: any[];

  @Column({ name: 'precautions_snomed', type: 'jsonb', default: '[]' })
  precautionsSnomed: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

