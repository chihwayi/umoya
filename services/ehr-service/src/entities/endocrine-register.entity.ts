import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('endocrine_register')
export class EndocrineRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  @Column({ name: 'endocrine_system', length: 30 }) endocrineSystem: string; // thyroid|adrenal|pituitary|parathyroid|gonadal|multiple
  // Thyroid
  @Column({ name: 'thyroid_diagnosis', length: 50, nullable: true }) thyroidDiagnosis: string | null; // hypothyroid|hyperthyroid|hashimotos|graves|nodule|cancer
  @Column({ name: 'tsh_miu_l', type: 'numeric', precision: 8, scale: 3, nullable: true }) tshMiuL: number | null;
  @Column({ name: 'ft4_pmol_l', type: 'numeric', precision: 6, scale: 2, nullable: true }) ft4PmolL: number | null;
  @Column({ name: 'ft3_pmol_l', type: 'numeric', precision: 6, scale: 2, nullable: true }) ft3PmolL: number | null;
  @Column({ name: 'tpo_antibody_positive', type: 'boolean', nullable: true }) tpoAntibodyPositive: boolean | null;
  @Column({ name: 'trab_positive', type: 'boolean', nullable: true }) trabPositive: boolean | null;
  // Adrenal
  @Column({ name: 'adrenal_diagnosis', length: 50, nullable: true }) adrenalDiagnosis: string | null; // cushings|addisons|phaeochromocytoma|incidentaloma|hyperaldosteronism
  // Pituitary
  @Column({ name: 'pituitary_diagnosis', length: 50, nullable: true }) pituitaryDiagnosis: string | null; // acromegaly|prolactinoma|pan_hypopituitarism|diabetes_insipidus
  // Treatment
  @Column({ name: 'on_levothyroxine', type: 'boolean', default: false }) onLevothyroxine: boolean;
  @Column({ name: 'levothyroxine_dose_mcg', type: 'integer', nullable: true }) levothyroxineDoseMcg: number | null;
  @Column({ name: 'on_antithyroid', type: 'boolean', default: false }) onAntithyroid: boolean;
  @Column({ name: 'on_steroid_replacement', type: 'boolean', default: false }) onSteroidReplacement: boolean;
  @Column({ name: 'on_growth_hormone', type: 'boolean', default: false }) onGrowthHormone: boolean;
  @Column({ name: 'radioiodine_therapy', type: 'boolean', default: false }) radioiodineTherapy: boolean;
  @Column({ name: 'thyroidectomy_done', type: 'boolean', default: false }) thyroidectomyDone: boolean;
  @Column({ name: 'thyroidectomy_date', type: 'date', nullable: true }) thyroidectomyDate: string | null;
  @Column({ name: 'status', length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
