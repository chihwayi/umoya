import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ncd_complication_events')
export class NcdComplicationEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'complication_type', length: 60 }) complicationType: string;
  @Column({ length: 15 }) severity: string;
  @Column({ type: 'jsonb', nullable: true }) measurements: Record<string, number> | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
