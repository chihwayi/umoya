import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('nutrition_monitoring')
export class NutritionMonitoring {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'monitoring_date', type: 'date' }) monitoringDate: string;
  @Column({ name: 'actual_calories_intake', type: 'numeric', precision: 7, scale: 1, nullable: true }) actualCaloriesIntake: number;
  @Column({ name: 'actual_protein_intake_g', type: 'numeric', precision: 6, scale: 1, nullable: true }) actualProteinIntakeG: number;
  @Column({ name: 'oral_intake_percent', type: 'smallint', nullable: true }) oralIntakePercent: number;
  @Column({ name: 'tolerance_issues', type: 'text', nullable: true }) toleranceIssues: string;
  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) weightKg: number;
  @Column({ name: 'albumin_g_dl', type: 'numeric', precision: 4, scale: 2, nullable: true }) albuminGDl: number;
  @Column({ name: 'prealbumin_mg_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) prealbuminMgDl: number;
  @Column({ name: 'plan_adjustment', type: 'text', nullable: true }) planAdjustment: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
