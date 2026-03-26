import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('growth_measurements')
export class GrowthMeasurement {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'measured_at', type: 'date', default: () => 'CURRENT_DATE' }) measuredAt: Date;
  @Column({ name: 'age_months', type: 'numeric', precision: 6, scale: 2, nullable: true }) ageMonths?: number;
  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 3, nullable: true }) weightKg?: number;
  @Column({ name: 'height_cm', type: 'numeric', precision: 6, scale: 2, nullable: true }) heightCm?: number;
  @Column({ name: 'head_circumference_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) headCircumferenceCm?: number;
  @Column({ name: 'muac_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) muacCm?: number;

  // WHO Z-scores (calculated by CDSS /growth/assess)
  @Column({ name: 'weight_for_age_z', type: 'numeric', precision: 6, scale: 3, nullable: true }) weightForAgeZ?: number;
  @Column({ name: 'height_for_age_z', type: 'numeric', precision: 6, scale: 3, nullable: true }) heightForAgeZ?: number;
  @Column({ name: 'weight_for_height_z', type: 'numeric', precision: 6, scale: 3, nullable: true }) weightForHeightZ?: number;
  @Column({ name: 'bmi_for_age_z', type: 'numeric', precision: 6, scale: 3, nullable: true }) bmiForAgeZ?: number;
  @Column({ name: 'growth_chart_percentile', type: 'numeric', precision: 5, scale: 2, nullable: true }) growthChartPercentile?: number;

  /** e.g. normal | underweight | wasted | stunted | overweight | obese */
  @Column({ name: 'nutritional_status', length: 30, nullable: true }) nutritionalStatus?: string;

  @Column({ name: 'measured_by', type: 'uuid', nullable: true }) measuredById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'measured_by' }) measuredBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;  @Column({ name: 'bmi_for_age_zscore', type: 'numeric', precision: 5, scale: 2, nullable: true })
  bmiForAgeZscore?: number;

  @Column({ name: 'height_for_age_zscore', type: 'numeric', precision: 5, scale: 2, nullable: true })
  heightForAgeZscore?: number;

  @Column({ name: 'measurement_date', type: 'date' })
  measurementDate: Date;

  @Column({ name: 'weight_for_age_zscore', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightForAgeZscore?: number;

  @Column({ name: 'weight_for_height_zscore', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightForHeightZscore?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
