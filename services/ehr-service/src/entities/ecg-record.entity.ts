import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ecg_record')
export class EcgRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string | null;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'indication', length: 200, nullable: true }) indication: string | null;
  @Column({ name: 'heart_rate_bpm', type: 'integer', nullable: true }) heartRateBpm: number | null;
  @Column({ name: 'pr_interval_ms', type: 'integer', nullable: true }) prIntervalMs: number | null;
  @Column({ name: 'qrs_duration_ms', type: 'integer', nullable: true }) qrsDurationMs: number | null;
  @Column({ name: 'qtc_ms', type: 'integer', nullable: true }) qtcMs: number | null;
  @Column({ name: 'qt_interval_ms', type: 'integer', nullable: true }) qtIntervalMs: number | null;
  @Column({ name: 'rhythm', length: 50, nullable: true }) rhythm: string | null; // sinus|af|flutter|vt|svt|junctional|paced|asystole
  @Column({ name: 'axis', length: 30, nullable: true }) axis: string | null; // normal|left_deviation|right_deviation
  @Column({ name: 'p_wave', length: 50, nullable: true }) pWave: string | null;
  @Column({ name: 'st_changes', length: 100, nullable: true }) stChanges: string | null; // none|elevation|depression|location
  @Column({ name: 't_wave_changes', length: 100, nullable: true }) tWaveChanges: string | null;
  @Column({ name: 'q_waves', length: 100, nullable: true }) qWaves: string | null;
  @Column({ name: 'bundle_branch_block', length: 20, nullable: true }) bundleBranchBlock: string | null; // none|LBBB|RBBB|incomplete_LBBB|incomplete_RBBB
  @Column({ name: 'lv_hypertrophy', type: 'boolean', default: false }) lvHypertrophy: boolean;
  @Column({ name: 'rv_hypertrophy', type: 'boolean', default: false }) rvHypertrophy: boolean;
  @Column({ name: 'acs_features', type: 'boolean', default: false }) acsFeatures: boolean;
  @Column({ name: 'interpretation', type: 'text', nullable: true }) interpretation: string | null;
  @Column({ name: 'interpreted_by', type: 'uuid', nullable: true }) interpretedBy: string | null;
  @Column({ name: 'ai_interpretation', type: 'text', nullable: true }) aiInterpretation: string | null;
  @Column({ name: 'ecg_file_url', length: 500, nullable: true }) ecgFileUrl: string | null;
  @Column({ name: 'requires_urgent_review', type: 'boolean', default: false }) requiresUrgentReview: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
