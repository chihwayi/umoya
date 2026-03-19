import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sedation_records')
export class SedationRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'rass_target', type: 'smallint', nullable: true }) rassTarget: number;
  @Column({ name: 'rass_actual', type: 'smallint', nullable: true }) rassActual: number;
  @Column({ name: 'cam_icu_result', type: 'text', nullable: true }) camIcuResult: string;
  @Column({ type: 'jsonb', default: '{}' }) analgesic: any;
  @Column({ type: 'jsonb', default: '{}' }) sedative: any;
  @Column({ name: 'nmba_used', type: 'boolean', default: false }) nmbaUsed: boolean;
  @Column({ name: 'sab_hold_date', type: 'date', nullable: true }) sabHoldDate: string;
  @Column({ name: 'wakefulness_trial_completed', type: 'boolean', default: false }) wakefulnessTrialCompleted: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
