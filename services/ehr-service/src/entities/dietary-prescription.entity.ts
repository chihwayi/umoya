import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dietary_prescriptions')
export class DietaryPrescription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'prescribed_by', type: 'uuid' }) prescribedBy: string;
  @Column({ name: 'prescription_date', type: 'date' }) prescriptionDate: string;
  @Column({ name: 'calorie_target', type: 'numeric', precision: 7, scale: 1, nullable: true }) calorieTarget: number;
  @Column({ name: 'protein_target_g', type: 'numeric', precision: 6, scale: 1, nullable: true }) proteinTargetG: number;
  @Column({ name: 'fluid_target_ml', type: 'numeric', precision: 7, scale: 1, nullable: true }) fluidTargetMl: number;
  @Column({ type: 'text' }) route: string;
  @Column({ type: 'text', nullable: true }) formula: string;
  @Column({ name: 'special_diet', type: 'text', nullable: true }) specialDiet: string;
  @Column({ type: 'jsonb', default: '[]' }) restrictions: any;
  @Column({ name: 'duration_days', type: 'smallint', nullable: true }) durationDays: number;
  @Column({ name: 'review_date', type: 'date', nullable: true }) reviewDate: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
