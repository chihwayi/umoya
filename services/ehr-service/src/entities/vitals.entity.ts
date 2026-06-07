import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity({ name: 'vitals' })
export class Vitals {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  // ── Blood Pressure ──────────────────────────────────────────────────────────
  // Stored as separate INT columns so AI/queries can filter/trend numerically.
  // The legacy bloodPressure VARCHAR is kept for backward compatibility.
  @Column({ name: 'systolic_bp', type: 'int', nullable: true })
  systolicBp?: number;

  @Column({ name: 'diastolic_bp', type: 'int', nullable: true })
  diastolicBp?: number;

  /** Legacy string column — kept for backward compat, always derived from systolicBp/diastolicBp. */
  @Column({ name: 'blood_pressure', type: 'varchar', length: 20, nullable: true })
  bloodPressure?: string;

  // ── Core vitals ─────────────────────────────────────────────────────────────
  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate?: number;

  @Column({ name: 'temperature', type: 'decimal', precision: 4, scale: 2, nullable: true })
  temperature?: number;

  @Column({ name: 'oxygen_saturation', type: 'int', nullable: true })
  oxygenSaturation?: number;

  @Column({ name: 'respiratory_rate', type: 'int', nullable: true })
  respiratoryRate?: number;

  @Column({ name: 'weight', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight?: number;

  @Column({ name: 'height', type: 'decimal', precision: 5, scale: 2, nullable: true })
  height?: number;

  @Column({ name: 'bmi', type: 'decimal', precision: 4, scale: 2, nullable: true })
  bmi?: number;

  @Column({ name: 'blood_glucose', type: 'decimal', precision: 5, scale: 2, nullable: true })
  bloodGlucose?: number;

  // ── Pain ────────────────────────────────────────────────────────────────────
  @Column({ name: 'pain_level', type: 'int', nullable: true })
  painLevel?: number;

  @Column({ name: 'pain_location', type: 'varchar', length: 100, nullable: true })
  painLocation?: string;

  @Column({ name: 'pain_character', type: 'varchar', length: 100, nullable: true })
  painCharacter?: string;

  // ── Extended anthropometric ─────────────────────────────────────────────────
  @Column({ name: 'waist_circumference', type: 'decimal', precision: 5, scale: 2, nullable: true })
  waistCircumference?: number;

  @Column({ name: 'head_circumference', type: 'decimal', precision: 5, scale: 2, nullable: true })
  headCircumference?: number;

  /** Mid-upper arm circumference (malnutrition screening) */
  @Column({ name: 'muac', type: 'decimal', precision: 5, scale: 2, nullable: true })
  muac?: number;

  @Column({ name: 'peak_flow_rate', type: 'int', nullable: true })
  peakFlowRate?: number;

  // ── AI Clinical Scoring ─────────────────────────────────────────────────────
  /** NEWS2 score — auto-calculated by VitalsService on every save. Never set manually. */
  @Column({ name: 'news_score', type: 'int', nullable: true })
  newsScore?: number;

  /**
   * Full CDSS copilot insights computed at save time (risk level, governor
   * banner, syndrome alerts, copilot summary, recommendations). Persisted so the
   * interpretation can be re-displayed per record after the vitals pane closes.
   */
  @Column({ name: 'cdss_insights', type: 'jsonb', nullable: true })
  cdssInsights?: any;

  /**
   * Structured SNOMED clinical observations captured alongside the vitals
   * (e.g. ACS, severe sepsis). Fed into the CDSS risk engine as active findings.
   */
  @Column({ name: 'clinical_observations', type: 'jsonb', nullable: true })
  clinicalObservations?: Array<{ conceptId?: string; term?: string }>;

  // ── Provenance ──────────────────────────────────────────────────────────────
  @Column({ name: 'vital_source', type: 'varchar', length: 30, default: 'manual' })
  vitalSource: string = 'manual';

  // ── Notes & metadata ────────────────────────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser?: User;
  @Column({ name: 'gcs_eye', type: 'int', nullable: true })
  gcsEye?: number;

  @Column({ name: 'gcs_motor', type: 'int', nullable: true })
  gcsMotor?: number;

  @Column({ name: 'gcs_verbal', type: 'int', nullable: true })
  gcsVerbal?: number;

  @Column({ name: 'glasgow_coma_scale', type: 'int', nullable: true })
  glasgowComaScale?: number;

  @Column({ name: 'hip_cm', type: 'numeric', precision: 5, scale: 1, nullable: true })
  hipCm?: number;

  @Column({ name: 'pain_score', type: 'int', nullable: true })
  painScore?: number;

  @Column({ name: 'pupil_left_mm', type: 'numeric', precision: 3, scale: 1, nullable: true })
  pupilLeftMm?: number;

  @Column({ name: 'pupil_reaction', type: 'text', nullable: true })
  pupilReaction?: string;

  @Column({ name: 'pupil_right_mm', type: 'numeric', precision: 3, scale: 1, nullable: true })
  pupilRightMm?: number;

  @Column({ name: 'spo2_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  spo2Percent?: number;

  @Column({ name: 'waist_cm', type: 'numeric', precision: 5, scale: 1, nullable: true })
  waistCm?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
