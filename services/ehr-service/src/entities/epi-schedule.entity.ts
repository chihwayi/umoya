import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('epi_schedules')
export class EpiSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'country_code', length: 3 })
  countryCode: string;

  @Column({ name: 'vaccine_name', length: 100 })
  vaccineName: string;

  @Column({ name: 'dose_number' })
  doseNumber: number;

  @Column({ name: 'due_age_days' })
  dueAgeDays: number;

  @Column({ name: 'window_early_days', default: 0 })
  windowEarlyDays: number;

  @Column({ name: 'window_late_days', default: 30 })
  windowLateDays: number;

  @Column({ name: 'antigen_code', length: 50, nullable: true })
  antigenCode: string;

  @Column({ length: 20, nullable: true })
  route: string;

  @Column({ length: 50, nullable: true })
  site: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
