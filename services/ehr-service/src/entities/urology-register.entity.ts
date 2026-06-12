import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('urology_register')
export class UrologyRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  @Column({ name: 'diagnosis_category', length: 30 }) diagnosisCategory: string; // bph|renal_stone|uti|urological_cancer|incontinence|erectile_dysfunction|stricture|neurogenic_bladder
  // BPH / LUTS
  @Column({ name: 'ipss_score', type: 'integer', nullable: true }) ipssScore: number | null; // 0–35
  @Column({ name: 'psa_ng_ml', type: 'numeric', precision: 6, scale: 2, nullable: true }) psaNgMl: number | null;
  @Column({ name: 'psa_date', type: 'date', nullable: true }) psaDate: string | null;
  @Column({ name: 'prostate_volume_ml', type: 'numeric', precision: 5, scale: 1, nullable: true }) prostateVolumeMl: number | null;
  // Renal stones
  @Column({ name: 'stone_size_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) stoneSizeMm: number | null;
  @Column({ name: 'stone_location', length: 50, nullable: true }) stoneLocation: string | null; // renal_pelvis|ureter_upper|ureter_mid|ureter_lower|bladder
  @Column({ name: 'stone_composition', length: 50, nullable: true }) stoneComposition: string | null; // calcium_oxalate|uric_acid|struvite|cystine
  // Cancer
  @Column({ name: 'cancer_type', length: 50, nullable: true }) cancerType: string | null; // prostate|bladder|renal|testicular|penile
  @Column({ name: 'gleason_score', length: 10, nullable: true }) gleasonScore: string | null;
  @Column({ name: 'tumour_stage', length: 20, nullable: true }) tumourStage: string | null;
  @Column({ name: 'on_adt', type: 'boolean', default: false }) onAdt: boolean; // androgen deprivation
  @Column({ name: 'status', length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
