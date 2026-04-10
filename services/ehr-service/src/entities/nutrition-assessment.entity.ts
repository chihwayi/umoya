import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('nutrition_assessments')
export class NutritionAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy: string | null;

  @Column({ name: 'muac_mm', type: 'int', nullable: true })
  muacMm: number | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'height_cm', type: 'numeric', precision: 5, scale: 2, nullable: true })
  heightCm: number | null;

  @Column({ name: 'whz_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  whzScore: number | null;

  @Column({ name: 'bilateral_pitting_oedema', default: false })
  bilateralPittingOedema: boolean;

  @Column({ name: 'oedema_grade', length: 5, nullable: true })
  oedemaGrade: string | null;

  @Column({ length: 10 })
  classification: string;

  @Column({ name: 'program_type', length: 10, nullable: true })
  programType: string | null;

  @Column({ name: 'admission_type', length: 20, nullable: true })
  admissionType: string | null;

  @Column({ name: 'discharge_reason', length: 30, nullable: true })
  dischargeReason: string | null;

  @Column({ name: 'discharge_date', type: 'date', nullable: true })
  dischargeDate: string | null;

  @Column({ length: 20, nullable: true })
  outcome: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
