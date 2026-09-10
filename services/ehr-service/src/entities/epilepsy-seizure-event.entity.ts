import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('epilepsy_seizure_events')
export class EpilepsySeizureEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'epilepsy_register_id', type: 'uuid', nullable: true }) epilepsyRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'seizure_type', length: 60 }) seizureType: string;
  @Column({ name: 'duration_seconds', type: 'int' }) durationSeconds: number;
  @Column({ name: 'is_status_epilepticus', type: 'boolean', default: false }) isStatusEpilepticus: boolean;
  @Column({ name: 'aed_given', type: 'boolean', default: false }) aedGiven: boolean;
  @Column({ name: 'aed_detail', length: 200, nullable: true }) aedDetail: string | null;
  @Column({ name: 'post_ictal', type: 'boolean', default: false }) postIctal: boolean;
  @Column({ name: 'consciousness_lost', type: 'boolean', default: true }) consciousnessLost: boolean;
  @Column({ name: 'injury_sustained', type: 'boolean', default: false }) injurySustained: boolean;
  @Column({ name: 'injury_detail', length: 200, nullable: true }) injuryDetail: string | null;
  @Column({ name: 'trigger_identified', length: 100, nullable: true }) triggerIdentified: string | null;
  @Column({ name: 'emergency_services_called', type: 'boolean', default: false }) emergencyServicesCalled: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
