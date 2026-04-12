import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_complication_screenings')
export class ScdComplicationScreening {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'screened_by', type: 'uuid' }) screenedBy: string;
  @Column({ name: 'screened_at', type: 'date' }) screenedAt: string;
  @Column({ name: 'screening_type', length: 30 }) screeningType: string;
  @Column({ name: 'result_normal', type: 'boolean', nullable: true }) resultNormal: boolean | null;
  @Column({ name: 'result_detail', type: 'text', nullable: true }) resultDetail: string | null;
  @Column({ name: 'tcd_velocity_cm_s', type: 'numeric', precision: 5, scale: 1, nullable: true }) tcdVelocityCmS: number | null;
  @Column({ name: 'tcd_classification', length: 20, nullable: true }) tcdClassification: string | null;
  @Column({ name: 'egfr_ml_min', type: 'numeric', precision: 6, scale: 1, nullable: true }) egfrMlMin: number | null;
  @Column({ name: 'urine_albumin_creatinine', type: 'numeric', precision: 7, scale: 2, nullable: true }) urineAlbuminCreatinine: number | null;
  @Column({ type: 'boolean', default: false }) referred: boolean;
  @Column({ name: 'referral_reason', type: 'text', nullable: true }) referralReason: string | null;
  @Column({ name: 'next_screening_date', type: 'date', nullable: true }) nextScreeningDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
