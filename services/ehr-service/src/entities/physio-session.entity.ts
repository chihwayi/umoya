import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('physio_session')
export class PhysioSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'physio_referral_id', type: 'uuid', nullable: true }) physioReferralId: string | null;
  @Column({ name: 'therapist_id', type: 'uuid', nullable: true }) therapistId: string | null;
  @Column({ name: 'session_date', type: 'date' }) sessionDate: string;
  @Column({ name: 'session_number', type: 'integer' }) sessionNumber: number;
  @Column({ name: 'subjective', type: 'text', nullable: true }) subjective: string | null; // patient-reported
  @Column({ name: 'pain_score', type: 'integer', nullable: true }) painScore: number | null; // 0–10
  @Column({ name: 'objective_findings', type: 'text', nullable: true }) objectiveFindings: string | null;
  @Column({ name: 'rom_measurements', type: 'jsonb', nullable: true }) romMeasurements: Record<string, any> | null; // range of motion
  @Column({ name: 'muscle_strength_mrc', type: 'jsonb', nullable: true }) muscleStrengthMrc: Record<string, any> | null;
  @Column({ name: 'interventions', type: 'text', nullable: true }) interventions: string | null; // exercises|manual_therapy|electrotherapy|hydrotherapy
  @Column({ name: 'home_exercise_programme', type: 'text', nullable: true }) homeExerciseProgramme: string | null;
  @Column({ name: 'goals_progress', type: 'text', nullable: true }) goalsProgress: string | null;
  @Column({ name: 'functional_outcome_score', type: 'numeric', precision: 5, scale: 1, nullable: true }) functionalOutcomeScore: number | null;
  @Column({ name: 'outcome_tool', length: 30, nullable: true }) outcomeTool: string | null; // Barthel|FIM|DASH|Oxford|6MWT
  @Column({ name: 'discharge_recommended', type: 'boolean', default: false }) dischargeRecommended: boolean;
  @Column({ type: 'text', nullable: true }) plan: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
