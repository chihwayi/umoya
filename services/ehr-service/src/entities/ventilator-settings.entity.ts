import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ventilator_settings')
export class VentilatorSettings {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ type: 'text' }) mode: string;
  @Column({ name: 'tidal_volume_ml', type: 'numeric', precision: 6, scale: 1, nullable: true }) tidalVolumeMl: number;
  @Column({ type: 'smallint', nullable: true }) rate: number;
  @Column({ name: 'fio2_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) fio2Pct: number;
  @Column({ name: 'peep_cmh2o', type: 'numeric', precision: 5, scale: 1, nullable: true }) peepCmh2o: number;
  @Column({ name: 'i_pressure_cmh2o', type: 'numeric', precision: 5, scale: 1, nullable: true }) iPressureCmh2o: number;
  @Column({ name: 'pip_cmh2o', type: 'numeric', precision: 5, scale: 1, nullable: true }) pipCmh2o: number;
  @Column({ name: 'map_airway', type: 'numeric', precision: 5, scale: 1, nullable: true }) mapAirway: number;
  @Column({ name: 'compliance_ml_cmh2o', type: 'numeric', precision: 6, scale: 2, nullable: true }) complianceMlCmh2o: number;
  @Column({ name: 'spo2_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) spo2Pct: number;
  @Column({ name: 'pao2_kpa', type: 'numeric', precision: 5, scale: 1, nullable: true }) pao2Kpa: number;
  @Column({ name: 'paco2_kpa', type: 'numeric', precision: 5, scale: 1, nullable: true }) paco2Kpa: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
