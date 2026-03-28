import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('peak_flow_diaries')
export class PeakFlowDiary {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'pef_value', type: 'numeric', precision: 5, scale: 1 }) pefValue: number;
  @Column({ name: 'percent_predicted', type: 'numeric', precision: 5, scale: 1, nullable: true }) percentPredicted: number;
  @Column({ type: 'text', nullable: true }) zone: string;
  @Column({ type: 'jsonb', default: '[]' }) symptoms: any;
  @Column({ name: 'medication_taken', type: 'text', nullable: true }) medicationTaken: string;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'pef_l_min', type: 'numeric', precision: 5, scale: 1, nullable: true })
  pefLMin?: number;

  @Column({ name: 'personal_best_l_min', type: 'numeric', precision: 5, scale: 1, nullable: true })
  personalBestLMin?: number;

  @Column({ name: 'reliever_taken', type: 'boolean', nullable: true, default: false })
  relieverTaken: boolean = false;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
