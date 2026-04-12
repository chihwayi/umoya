import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_crisis_events')
export class ScdCrisisEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'crisis_type', length: 30 }) crisisType: string;
  @Column({ length: 15 }) severity: string;
  @Column({ name: 'pain_score', type: 'int', nullable: true }) painScore: number | null;
  @Column({ name: 'trigger_identified', length: 100, nullable: true }) triggerIdentified: string | null;
  @Column({ name: 'sbp_at_event', type: 'int', nullable: true }) sbpAtEvent: number | null;
  @Column({ name: 'dbp_at_event', type: 'int', nullable: true }) dbpAtEvent: number | null;
  @Column({ name: 'spo2_at_event', type: 'int', nullable: true }) spo2AtEvent: number | null;
  @Column({ name: 'hb_at_event', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbAtEvent: number | null;
  @Column({ name: 'wbc_at_event', type: 'numeric', precision: 6, scale: 2, nullable: true }) wbcAtEvent: number | null;
  @Column({ type: 'text', nullable: true }) management: string | null;
  @Column({ name: 'analgesia_given', length: 200, nullable: true }) analgesiaGiven: string | null;
  @Column({ name: 'transfusion_given', type: 'boolean', default: false }) transfusionGiven: boolean;
  @Column({ name: 'transfusion_units', type: 'int', nullable: true }) transfusionUnits: number | null;
  @Column({ name: 'hospitalised', type: 'boolean', default: false }) hospitalised: boolean;
  @Column({ name: 'hospital_days', type: 'int', nullable: true }) hospitalDays: number | null;
  @Column({ length: 30, nullable: true }) outcome: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
