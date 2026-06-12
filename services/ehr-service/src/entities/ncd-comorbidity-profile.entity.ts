import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Cross-specialty NCD comorbidity profile — shared record linking DM, HTN, CKD, CVD, retinopathy
@Entity('ncd_comorbidity_profile')
export class NcdComorbidityProfile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid', unique: true }) patientId: string;
  @Column({ name: 'last_updated_by', type: 'uuid', nullable: true }) lastUpdatedBy: string | null;
  // Diabetes
  @Column({ name: 'has_diabetes', type: 'boolean', default: false }) hasDiabetes: boolean;
  @Column({ name: 'diabetes_type', length: 10, nullable: true }) diabetesType: string | null; // T1|T2|GDM|MODY
  @Column({ name: 'hba1c_latest', type: 'numeric', precision: 4, scale: 1, nullable: true }) hba1cLatest: number | null;
  @Column({ name: 'hba1c_date', type: 'date', nullable: true }) hba1cDate: string | null;
  // Hypertension
  @Column({ name: 'has_hypertension', type: 'boolean', default: false }) hasHypertension: boolean;
  @Column({ name: 'bp_systolic_latest', type: 'integer', nullable: true }) bpSystolicLatest: number | null;
  @Column({ name: 'bp_diastolic_latest', type: 'integer', nullable: true }) bpDiastolicLatest: number | null;
  @Column({ name: 'bp_date', type: 'date', nullable: true }) bpDate: string | null;
  // Cardiovascular
  @Column({ name: 'has_cvd', type: 'boolean', default: false }) hasCvd: boolean;
  @Column({ name: 'cvd_type', length: 100, nullable: true }) cvdType: string | null; // IHD|HF|AF|PAD|stroke
  @Column({ name: 'nyha_class', length: 5, nullable: true }) nyhaClass: string | null; // I|II|III|IV
  @Column({ name: 'lvef_percent', type: 'numeric', precision: 4, scale: 1, nullable: true }) lvefPercent: number | null;
  // Renal
  @Column({ name: 'has_ckd', type: 'boolean', default: false }) hasCkd: boolean;
  @Column({ name: 'ckd_stage', length: 5, nullable: true }) ckdStage: string | null; // G1|G2|G3a|G3b|G4|G5
  @Column({ name: 'egfr_latest', type: 'numeric', precision: 5, scale: 1, nullable: true }) egfrLatest: number | null;
  @Column({ name: 'egfr_date', type: 'date', nullable: true }) egfrDate: string | null;
  @Column({ name: 'on_dialysis', type: 'boolean', default: false }) onDialysis: boolean;
  // Ophthalmology / Retinopathy
  @Column({ name: 'has_retinopathy', type: 'boolean', default: false }) hasRetinopathy: boolean;
  @Column({ name: 'retinopathy_grade', length: 20, nullable: true }) retinopathyGrade: string | null; // none|mild_npdr|moderate_npdr|severe_npdr|pdr|macular_oedema
  @Column({ name: 'last_eye_review_date', type: 'date', nullable: true }) lastEyeReviewDate: string | null;
  @Column({ name: 'next_eye_review_date', type: 'date', nullable: true }) nextEyeReviewDate: string | null;
  // Neuropathy
  @Column({ name: 'has_neuropathy', type: 'boolean', default: false }) hasNeuropathy: boolean;
  @Column({ name: 'neuropathy_type', length: 50, nullable: true }) neuropathyType: string | null;
  // Dyslipidaemia
  @Column({ name: 'has_dyslipidaemia', type: 'boolean', default: false }) hasDyslipidaemia: boolean;
  @Column({ name: 'ldl_latest_mmol_l', type: 'numeric', precision: 4, scale: 2, nullable: true }) ldlLatestMmolL: number | null;
  @Column({ name: 'ldl_date', type: 'date', nullable: true }) ldlDate: string | null;
  @Column({ name: 'on_statin', type: 'boolean', default: false }) onStatin: boolean;
  // Foot care
  @Column({ name: 'has_diabetic_foot', type: 'boolean', default: false }) hasDiabeticFoot: boolean;
  @Column({ name: 'foot_risk_category', length: 20, nullable: true }) footRiskCategory: string | null; // low|moderate|high|active_ulcer
  @Column({ name: 'last_foot_exam_date', type: 'date', nullable: true }) lastFootExamDate: string | null;
  // Risk scores
  @Column({ name: 'framingham_risk_10yr_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) framinghamRisk10yrPct: number | null;
  @Column({ name: 'who_cvd_risk_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) whoCvdRiskPct: number | null;
  @Column({ name: 'overall_risk', length: 20, nullable: true }) overallRisk: string | null; // low|moderate|high|very_high
  @Column({ name: 'alerts', type: 'jsonb', nullable: true }) alerts: any[] | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
