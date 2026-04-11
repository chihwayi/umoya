import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('ntd_assessments')
export class NtdAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'disease_type' }) diseaseType: string;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'assessed_by', type: 'uuid', nullable: true }) assessedBy: string | null;
  @Column({ name: 'disease_stage', nullable: true }) diseaseStage: string | null;
  @Column({ name: 'disability_grade', type: 'int', nullable: true }) disabilityGrade: number | null;
  @Column({ name: 'mda_eligible', type: 'boolean', nullable: true }) mdaEligible: boolean | null;
  @Column({ name: 'treatment_given', nullable: true }) treatmentGiven: string | null;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) doseMg: number | null;
  @Column({ name: 'lot_number', nullable: true }) lotNumber: string | null;
  @Column({ name: 'follow_up_date', type: 'date', nullable: true }) followUpDate: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
