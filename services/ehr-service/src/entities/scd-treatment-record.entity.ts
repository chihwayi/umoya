import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_treatment_records')
export class ScdTreatmentRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'date' }) recordedAt: string;
  @Column({ name: 'treatment_type', length: 30 }) treatmentType: string;
  @Column({ name: 'drug_name', length: 100, nullable: true }) drugName: string | null;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) doseMg: number | null;
  @Column({ name: 'dose_mg_per_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) doseMgPerKg: number | null;
  @Column({ length: 50, nullable: true }) frequency: string | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ name: 'hb_g_dl', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbGDl: number | null;
  @Column({ name: 'mcv_fl', type: 'numeric', precision: 5, scale: 1, nullable: true }) mcvFl: number | null;
  @Column({ name: 'wbc_x10_9', type: 'numeric', precision: 6, scale: 2, nullable: true }) wbcX10_9: number | null;
  @Column({ name: 'anc_x10_9', type: 'numeric', precision: 6, scale: 2, nullable: true }) ancX10_9: number | null;
  @Column({ name: 'platelets_x10_9', type: 'numeric', precision: 7, scale: 2, nullable: true }) plateletsX10_9: number | null;
  @Column({ name: 'reticulocytes_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) reticulocytesPct: number | null;
  @Column({ name: 'hbf_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbfPct: number | null;
  @Column({ length: 30, nullable: true }) action: string | null;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
