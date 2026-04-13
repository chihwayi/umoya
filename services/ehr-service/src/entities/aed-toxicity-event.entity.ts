import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('aed_toxicity_events')
export class AedToxicityEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'aed_therapy_record_id', type: 'uuid', nullable: true }) aedTherapyRecordId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'drug_name', type: 'text' }) drugName: string;
  @Column({ name: 'toxicity_type', type: 'text' }) toxicityType: string;
  @Column({ type: 'text', default: 'mild' }) severity: string;
  @Column({ name: 'organ_system', type: 'text', nullable: true }) organSystem: string | null;
  @Column({ name: 'clinical_findings', type: 'text', nullable: true }) clinicalFindings: string | null;
  @Column({ name: 'lab_markers', type: 'jsonb', default: {} }) labMarkers: Record<string, any>;
  @Column({ name: 'action_taken', type: 'text', nullable: true }) actionTaken: string | null;
  @Column({ type: 'text', nullable: true }) outcome: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
