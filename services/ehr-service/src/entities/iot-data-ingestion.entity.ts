import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('iot_data_ingestions')
export class IotDataIngestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'device_id', type: 'uuid' }) deviceId: string;
  @Column({ name: 'measurement_type', type: 'text' }) measurementType: string; // glucose|bp_systolic|bp_diastolic|spo2|heart_rate|weight|steps
  @Column({ type: 'numeric' }) value: number;
  @Column({ type: 'text' }) unit: string;
  @Column({ name: 'measured_at', type: 'timestamptz' }) measuredAt: Date;
  @Column({ name: 'ingested_at', type: 'timestamptz' }) ingestedAt: Date;
  @Column({ name: 'fhir_observation_id', type: 'text', nullable: true }) fhirObservationId: string;
  @Column({ name: 'ai_processed', type: 'boolean', default: false }) aiProcessed: boolean;
  @Column({ name: 'alert_triggered', type: 'boolean', default: false }) alertTriggered: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
