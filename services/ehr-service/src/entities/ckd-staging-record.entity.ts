import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ckd_staging_records')
export class CkdStagingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'record_date', type: 'date' })
  recordDate: string;

  @Column({ name: 'creatinine_umol_l', type: 'decimal', precision: 8, scale: 2, nullable: true })
  creatinineUmolL: number | null;

  @Column({ name: 'egfr_ml_min_1_73m2', type: 'decimal', precision: 6, scale: 2, nullable: true })
  egfrMlMin173m2: number | null;

  @Column({ name: 'egfr_equation', type: 'text', default: 'CKD-EPI' })
  egfrEquation: string;

  @Column({ name: 'ckd_stage', type: 'text', nullable: true })
  ckdStage: string | null;

  @Column({ name: 'uacr_mg_g', type: 'decimal', precision: 8, scale: 2, nullable: true })
  uacrMgG: number | null;

  @Column({ name: 'urine_dipstick_protein', type: 'text', nullable: true })
  urineDipstickProtein: string | null;

  @Column({ name: 'albuminuria_category', type: 'text', nullable: true })
  albuminuriaCategory: string | null;

  @Column({ name: 'primary_cause', type: 'text', nullable: true })
  primaryCause: string | null;

  @Column({ name: 'haemoglobin_g_dl', type: 'decimal', precision: 4, scale: 1, nullable: true })
  haemoglobinGDl: number | null;

  @Column({ name: 'potassium_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true })
  potassiumMmolL: number | null;

  @Column({ name: 'bicarbonate_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true })
  bicarbonateMmolL: number | null;

  @Column({ name: 'phosphate_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true })
  phosphateMmolL: number | null;

  @Column({ name: 'sbp_mmhg', type: 'int', nullable: true })
  sbpMmhg: number | null;

  @Column({ name: 'dbp_mmhg', type: 'int', nullable: true })
  dbpMmhg: number | null;

  @Column({ name: 'referred_to_nephrology', type: 'boolean', default: false })
  referredToNephrology: boolean;

  @Column({ name: 'ace_inhibitor_arb', type: 'boolean', nullable: true })
  aceInhibitorArb: boolean | null;

  @Column({ name: 'metformin_stopped', type: 'boolean', nullable: true })
  metforminStopped: boolean | null;

  @Column({ name: 'nsaid_stopped', type: 'boolean', nullable: true })
  nsaidStopped: boolean | null;

  @Column({ name: 'dose_adjusted_drugs', type: 'jsonb', default: [] })
  doseAdjustedDrugs: Record<string, any>[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
