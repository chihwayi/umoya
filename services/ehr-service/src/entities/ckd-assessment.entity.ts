import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ckd_assessments')
export class CkdAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true }) egfr: number;
  @Column({ name: 'ckd_stage', type: 'text', nullable: true }) ckdStage: string;
  @Column({ name: 'albumin_creatinine_ratio', type: 'numeric', precision: 8, scale: 2, nullable: true }) albuminCreatinineRatio: number;
  @Column({ name: 'acr_category', type: 'text', nullable: true }) acrCategory: string;
  @Column({ name: 'serum_creatinine', type: 'numeric', precision: 7, scale: 3, nullable: true }) serumCreatinine: number;
  @Column({ name: 'serum_potassium', type: 'numeric', precision: 4, scale: 2, nullable: true }) serumPotassium: number;
  @Column({ name: 'serum_phosphate', type: 'numeric', precision: 5, scale: 2, nullable: true }) serumPhosphate: number;
  @Column({ name: 'serum_bicarbonate', type: 'numeric', precision: 5, scale: 2, nullable: true }) serumBicarbonate: number;
  @Column({ type: 'numeric', precision: 4, scale: 1, nullable: true }) haemoglobin: number;
  @Column({ name: 'primary_cause', type: 'text', nullable: true }) primaryCause: string;
  @Column({ name: 'ckd_progression_risk', type: 'text', nullable: true }) ckdProgressionRisk: string;
  @Column({ name: 'gfr_slope_monthly', type: 'numeric', precision: 6, scale: 3, nullable: true }) gfrSlopeMonthly: number;
  @Column({ name: 'on_ras_blockade', type: 'boolean', default: false }) onRasBlockade: boolean;
  @Column({ name: 'bp_systolic', type: 'smallint', nullable: true }) bpSystolic: number;
  @Column({ name: 'bp_diastolic', type: 'smallint', nullable: true }) bpDiastolic: number;
  @Column({ type: 'jsonb', default: '[]' }) complications: any;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'acr_mg_mmol', type: 'numeric', precision: 7, scale: 3, nullable: true })
  acrMgMmol?: number;

  @Column({ name: 'bicarbonate_mmol', type: 'numeric', precision: 5, scale: 2, nullable: true })
  bicarbonateMmol?: number;

  @Column({ name: 'creatinine_umol', type: 'numeric', precision: 7, scale: 2, nullable: true })
  creatinineUmol?: number;

  @Column({ name: 'egfr_formula', type: 'text', nullable: true })
  egfrFormula?: string;

  @Column({ name: 'egfr_ml_min', type: 'numeric', precision: 6, scale: 2, nullable: true })
  egfrMlMin?: number;

  @Column({ name: 'haemoglobin_g_dl', type: 'numeric', precision: 4, scale: 2, nullable: true })
  haemoglobinGDl?: number;

  @Column({ name: 'kdigo_risk', type: 'text', nullable: true })
  kdigoRisk?: string;

  @Column({ name: 'phosphate_mmol', type: 'numeric', precision: 5, scale: 2, nullable: true })
  phosphateMmol?: number;

  @Column({ name: 'potassium_mmol', type: 'numeric', precision: 5, scale: 2, nullable: true })
  potassiumMmol?: number;

  @Column({ name: 'urea_mmol', type: 'numeric', precision: 6, scale: 2, nullable: true })
  ureaMmol?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
