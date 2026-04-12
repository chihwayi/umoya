import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('scd_register')
export class ScdRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'enrolled_by', type: 'uuid' }) enrolledBy: string;
  @Column({ name: 'enrolled_at', type: 'date' }) enrolledAt: string;
  @Column({ length: 20 }) genotype: string;
  @Column({ name: 'diagnosis_method', length: 30, nullable: true }) diagnosisMethod: string | null;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true }) diagnosisDate: string | null;
  @Column({ name: 'is_confirmed', type: 'boolean', default: false }) isConfirmed: boolean;
  @Column({ name: 'linked_birth_id', type: 'uuid', nullable: true }) linkedBirthId: string | null;
  @Column({ name: 'baseline_hb_g_dl', type: 'numeric', precision: 4, scale: 1, nullable: true }) baselineHbGDl: number | null;
  @Column({ name: 'blood_group', length: 5, nullable: true }) bloodGroup: string | null;
  @Column({ name: 'has_stroke_history', type: 'boolean', default: false }) hasStrokeHistory: boolean;
  @Column({ name: 'has_acs_history', type: 'boolean', default: false }) hasAcsHistory: boolean;
  @Column({ name: 'has_priapism_history', type: 'boolean', default: false }) hasPriapismHistory: boolean;
  @Column({ name: 'has_renal_disease', type: 'boolean', default: false }) hasRenalDisease: boolean;
  @Column({ name: 'has_avascular_necrosis', type: 'boolean', default: false }) hasAvascularNecrosis: boolean;
  @Column({ name: 'on_hydroxyurea', type: 'boolean', default: false }) onHydroxyurea: boolean;
  @Column({ name: 'on_penicillin_prophylaxis', type: 'boolean', default: false }) onPenicillinProphylaxis: boolean;
  @Column({ name: 'on_folic_acid', type: 'boolean', default: false }) onFolicAcid: boolean;
  @Column({ name: 'on_malaria_prophylaxis', type: 'boolean', default: false }) onMalariaProphylaxis: boolean;
  @Column({ name: 'transcranial_doppler_velocity', type: 'numeric', precision: 5, scale: 1, nullable: true }) transcranialDopplerVelocity: number | null;
  @Column({ name: 'tcd_date', type: 'date', nullable: true }) tcdDate: string | null;
  @Column({ name: 'spleen_status', length: 20, nullable: true }) spleenStatus: string | null;
  @Column({ length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
