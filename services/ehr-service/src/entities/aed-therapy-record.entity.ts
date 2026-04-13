import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('aed_therapy_records')
export class AedTherapyRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'epilepsy_register_id', type: 'uuid', nullable: true }) epilepsyRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'drug_name', type: 'text' }) drugName: string;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2 }) doseMg: number;
  @Column({ type: 'text' }) frequency: string;
  @Column({ type: 'text', default: 'oral' }) route: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'stop_date', type: 'date', nullable: true }) stopDate: string | null;
  @Column({ name: 'stop_reason', type: 'text', nullable: true }) stopReason: string | null;
  @Column({ name: 'drug_level_result', type: 'numeric', precision: 8, scale: 2, nullable: true }) drugLevelResult: number | null;
  @Column({ name: 'drug_level_unit', type: 'text', nullable: true }) drugLevelUnit: string | null;
  @Column({ name: 'drug_level_date', type: 'date', nullable: true }) drugLevelDate: string | null;
  @Column({ name: 'drug_level_interpretation', type: 'text', nullable: true }) drugLevelInterpretation: string | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ name: 'prescriber_id', type: 'uuid', nullable: true }) prescriberId: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
