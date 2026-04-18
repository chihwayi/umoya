import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('retinopathy_screenings')
export class RetinopathyScreening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'screened_by', type: 'uuid' })
  screenedBy: string;

  @Column({ name: 'screening_date', type: 'date' })
  screeningDate: string;

  @Column({ type: 'text', default: 'ophthalmoscopy' })
  method: string;

  @Column({ name: 'right_eye_grade', type: 'text', nullable: true })
  rightEyeGrade: string | null;

  @Column({ name: 'left_eye_grade', type: 'text', nullable: true })
  leftEyeGrade: string | null;

  @Column({ name: 'right_eye_dme', type: 'boolean', nullable: true })
  rightEyeDme: boolean | null;

  @Column({ name: 'left_eye_dme', type: 'boolean', nullable: true })
  leftEyeDme: boolean | null;

  @Column({ name: 'right_eye_notes', type: 'text', nullable: true })
  rightEyeNotes: string | null;

  @Column({ name: 'left_eye_notes', type: 'text', nullable: true })
  leftEyeNotes: string | null;

  @Column({ name: 'overall_grade', type: 'text', nullable: true })
  overallGrade: string | null;

  @Column({ name: 'hypertensive_retinopathy_grade', type: 'int', nullable: true })
  hypertensiveRetinopathyGrade: number | null;

  @Column({ name: 'referred_to_ophthalmology', type: 'boolean', default: false })
  referredToOphthalmology: boolean;

  @Column({ type: 'text', nullable: true })
  urgency: string | null;

  @Column({ name: 'next_screening_months', type: 'int', default: 12 })
  nextScreeningMonths: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
