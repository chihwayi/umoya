import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vasopressor_records')
export class VasopressorRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ type: 'text' }) drug: string;
  @Column({ type: 'numeric', precision: 8, scale: 3, nullable: true }) dose: number;
  @Column({ type: 'text', nullable: true }) unit: string;
  @Column({ name: 'start_time', type: 'timestamptz' }) startTime: Date;
  @Column({ name: 'stop_time', type: 'timestamptz', nullable: true }) stopTime: Date;
  @Column({ type: 'jsonb', default: '[]' }) titrations: any;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
