import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('haematology_register')
export class HaematologyRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'diagnosis_category', length: 30 }) diagnosisCategory: string; // anaemia|lymphoma|leukaemia|myeloma|bleeding_disorder|thrombosis|mds|myeloproliferative
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  // Anaemia workup
  @Column({ name: 'anaemia_type', length: 50, nullable: true }) anaemiaType: string | null; // iron_deficiency|megaloblastic|haemolytic|aplastic|anaemia_chronic_disease|sickle_cell
  @Column({ name: 'baseline_hb_g_dl', type: 'numeric', precision: 4, scale: 1, nullable: true }) baselineHbGDl: number | null;
  @Column({ name: 'baseline_mcv_fl', type: 'numeric', precision: 5, scale: 1, nullable: true }) baselineMcvFl: number | null;
  // Malignancy staging
  @Column({ name: 'lymphoma_stage', length: 10, nullable: true }) lymphomaStage: string | null; // I|II|III|IV - Ann Arbor
  @Column({ name: 'leukaemia_subtype', length: 50, nullable: true }) leukaemiaSubtype: string | null; // ALL|AML|CLL|CML
  @Column({ name: 'iss_stage', length: 5, nullable: true }) issStage: string | null; // I|II|III - myeloma ISS
  @Column({ name: 'bone_marrow_biopsy_done', type: 'boolean', default: false }) bonemarrowBiopsyDone: boolean;
  @Column({ name: 'bone_marrow_result', type: 'text', nullable: true }) bonemarrowResult: string | null;
  @Column({ name: 'cytogenetics', type: 'text', nullable: true }) cytogenetics: string | null;
  // Treatment
  @Column({ name: 'on_chemotherapy', type: 'boolean', default: false }) onChemotherapy: boolean;
  @Column({ name: 'chemotherapy_regimen', length: 200, nullable: true }) chemotherapyRegimen: string | null;
  @Column({ name: 'on_anticoagulation', type: 'boolean', default: false }) onAnticoagulation: boolean;
  @Column({ name: 'transfusion_dependent', type: 'boolean', default: false }) transfusionDependent: boolean;
  @Column({ name: 'status', length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
