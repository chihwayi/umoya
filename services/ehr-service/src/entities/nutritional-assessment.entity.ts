import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('nutritional_assessments')
export class NutritionalAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'dietitian_id', type: 'uuid' }) dietitianId: string;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'sga_score', type: 'text', nullable: true }) sgaScore: string;
  @Column({ name: 'body_composition', type: 'jsonb', default: '{}' }) bodyComposition: any;
  @Column({ name: 'dietary_history', type: 'text', nullable: true }) dietaryHistory: string;
  @Column({ type: 'text', array: true, nullable: true }) intolerances: string[];
  @Column({ name: 'meal_frequency', type: 'smallint', nullable: true }) mealFrequency: number;
  @Column({ type: 'text', array: true, nullable: true }) supplements: string[];
  @Column({ name: 'current_weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) currentWeightKg: number;
  @Column({ name: 'ideal_weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) idealWeightKg: number;
  @Column({ name: 'height_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) heightCm: number;
  @Column({ type: 'numeric', precision: 4, scale: 1, nullable: true }) bmi: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
