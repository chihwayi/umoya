import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('seizure_records')
export class SeizureRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'seizure_date', type: 'timestamptz' })
  seizureDate: Date;

  @Column({ name: 'seizure_type', type: 'text' })
  seizureType: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'jsonb', default: [] })
  triggers: any[];

  @Column({ name: 'postictal_state', type: 'text', nullable: true })
  postictalState: string | null;

  @Column({ name: 'injury_occurred', type: 'boolean', default: false })
  injuryOccurred: boolean;

  @Column({ name: 'injury_details', type: 'text', nullable: true })
  injuryDetails: string | null;

  @Column({ name: 'witness_present', type: 'boolean', default: false })
  witnessPresent: boolean;

  @Column({ name: 'video_capture', type: 'boolean', default: false })
  videoCapture: boolean;

  @Column({ name: 'current_aed', type: 'jsonb', default: [] })
  currentAed: any[];

  @Column({ name: 'cluster_event', type: 'boolean', default: false })
  clusterEvent: boolean;

  @Column({ name: 'status_epilepticus', type: 'boolean', default: false })
  statusEpilepticus: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
