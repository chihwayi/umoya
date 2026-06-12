import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rheumatology_register')
export class RheumatologyRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string; // RA|SLE|PsA|AS|gout|OA|fibromyalgia|vasculitis
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  @Column({ name: 'rf_status', length: 20, nullable: true }) rfStatus: string | null; // positive|negative|unknown — rheumatoid factor
  @Column({ name: 'anti_ccp_status', length: 20, nullable: true }) antiCcpStatus: string | null;
  @Column({ name: 'ana_status', length: 20, nullable: true }) anaStatus: string | null;
  @Column({ name: 'hla_b27_status', length: 20, nullable: true }) hlaB27Status: string | null;
  @Column({ name: 'uric_acid_baseline_mmol_l', type: 'numeric', precision: 5, scale: 2, nullable: true }) uricAcidBaselineMmolL: number | null;
  @Column({ name: 'current_das28', type: 'numeric', precision: 4, scale: 2, nullable: true }) currentDas28: number | null; // Disease Activity Score 28
  @Column({ name: 'das28_date', type: 'date', nullable: true }) das28Date: string | null;
  @Column({ name: 'disease_activity', length: 20, nullable: true }) diseaseActivity: string | null; // remission|low|moderate|high
  @Column({ name: 'on_dmard', type: 'boolean', default: false }) onDmard: boolean;
  @Column({ name: 'on_biologic', type: 'boolean', default: false }) onBiologic: boolean;
  @Column({ name: 'on_steroid', type: 'boolean', default: false }) onSteroid: boolean;
  @Column({ name: 'joint_damage_present', type: 'boolean', default: false }) jointDamagePresent: boolean;
  @Column({ name: 'extra_articular_features', type: 'text', nullable: true }) extraArticularFeatures: string | null;
  @Column({ name: 'tb_screen_before_biologic', type: 'boolean', nullable: true }) tbScreenBeforeBiologic: boolean | null;
  @Column({ name: 'status', length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
