import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dialysis_records')
export class DialysisRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'session_date', type: 'timestamptz' }) sessionDate: Date;
  @Column({ name: 'dialysis_type', type: 'text' }) dialysisType: string;
  @Column({ name: 'session_duration_min', type: 'smallint', nullable: true }) sessionDurationMin: number;
  @Column({ name: 'pre_weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true }) preWeightKg: number;
  @Column({ name: 'post_weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true }) postWeightKg: number;
  @Column({ name: 'ultrafiltration_vol_ml', type: 'int', nullable: true }) ultrafiltrationVolMl: number;
  @Column({ name: 'blood_flow_rate', type: 'smallint', nullable: true }) bloodFlowRate: number;
  @Column({ name: 'dialysate_flow_rate', type: 'smallint', nullable: true }) dialysateFlowRate: number;
  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true }) ktv: number;
  @Column({ name: 'urrpercent', type: 'numeric', precision: 5, scale: 2, nullable: true }) urrPercent: number;
  @Column({ name: 'access_type', type: 'text', nullable: true }) accessType: string;
  @Column({ name: 'access_site', type: 'text', nullable: true }) accessSite: string;
  @Column({ name: 'pre_bp_systolic', type: 'smallint', nullable: true }) preBpSystolic: number;
  @Column({ name: 'pre_bp_diastolic', type: 'smallint', nullable: true }) preBpDiastolic: number;
  @Column({ name: 'post_bp_systolic', type: 'smallint', nullable: true }) postBpSystolic: number;
  @Column({ name: 'post_bp_diastolic', type: 'smallint', nullable: true }) postBpDiastolic: number;
  @Column({ type: 'jsonb', default: '[]' }) complications: any;
  @Column({ name: 'medications_given', type: 'jsonb', default: '[]' }) medicationsGiven: any;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
