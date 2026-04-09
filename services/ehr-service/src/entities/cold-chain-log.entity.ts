import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cold_chain_logs')
export class ColdChainLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vaccine_lot_id', nullable: true })
  vaccineLotId: string;

  @Column({ name: 'storage_location', length: 100 })
  storageLocation: string;

  @Column({ name: 'temperature_celsius', type: 'numeric', precision: 4, scale: 1 })
  temperatureCelsius: number;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: string;

  @Column({ name: 'excursion_detected', default: false })
  excursionDetected: boolean;

  @Column({ name: 'excursion_action', type: 'text', nullable: true })
  excursionAction: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
