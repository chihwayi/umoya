import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('notifiable_diseases')
export class NotifiableDisease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'country_code', length: 3 })
  countryCode: string;

  @Column({ name: 'disease_name', length: 100 })
  diseaseName: string;

  @Column({ name: 'icd10_codes', type: 'text', array: true })
  icd10Codes: string[];

  @Column({ name: 'alert_threshold', type: 'int', default: 1 })
  alertThreshold: number;

  @Column({ name: 'alert_window_days', type: 'int', default: 7 })
  alertWindowDays: number;

  @Column({ name: 'report_within_hours', type: 'int', default: 24 })
  reportWithinHours: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
