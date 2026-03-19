import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('palliative_assessments')
export class PalliativeAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ name: 'ecog_status', type: 'smallint', nullable: true }) ecogStatus: number;
  @Column({ name: 'kps_score', type: 'smallint', nullable: true }) kpsScore: number;
  @Column({ name: 'palliative_phase', type: 'text', nullable: true }) palliativePhase: string;
  @Column({ name: 'primary_diagnosis', type: 'text', nullable: true }) primaryDiagnosis: string;
  @Column({ name: 'prognosis_weeks', type: 'smallint', nullable: true }) prognosisWeeks: number;
  @Column({ name: 'prognosis_discussed_patient', type: 'boolean', default: false }) prognosisDiscussedPatient: boolean;
  @Column({ name: 'prognosis_discussed_family', type: 'boolean', default: false }) prognosisDiscussedFamily: boolean;
  @Column({ name: 'symptom_burden', type: 'jsonb', default: '{}' }) symptomBurden: any;
  @Column({ name: 'functional_trajectory', type: 'text', nullable: true }) functionalTrajectory: string;
  @Column({ name: 'ppi_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) ppiScore: number;
  @Column({ name: 'pps_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) ppsScore: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
