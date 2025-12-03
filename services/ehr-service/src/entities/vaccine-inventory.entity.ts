import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('vaccine_inventory')
export class VaccineInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vaccine_code', length: 20 })
  vaccineCode: string;

  @Column({ name: 'vaccine_name', length: 255 })
  vaccineName: string;

  @Column({ length: 100, nullable: true })
  manufacturer: string;

  @Column({ name: 'lot_number', length: 50 })
  lotNumber: string;

  @Column({ name: 'expiration_date', type: 'date' })
  expirationDate: Date;

  @Column({ name: 'quantity_received' })
  quantityReceived: number;

  @Column({ name: 'quantity_remaining' })
  quantityRemaining: number;

  @Column({ name: 'quantity_administered', default: 0 })
  quantityAdministered: number;

  @Column({ name: 'quantity_wasted', default: 0 })
  quantityWasted: number;

  @Column({ name: 'storage_location', length: 100, nullable: true })
  storageLocation: string;

  @Column({ name: 'storage_temperature_min', type: 'decimal', precision: 5, scale: 2, nullable: true })
  storageTemperatureMin: number;

  @Column({ name: 'storage_temperature_max', type: 'decimal', precision: 5, scale: 2, nullable: true })
  storageTemperatureMax: number;

  @Column({ name: 'current_temperature', type: 'decimal', precision: 5, scale: 2, nullable: true })
  currentTemperature: number;

  @Column({ name: 'temperature_alert', default: false })
  temperatureAlert: boolean;

  @Column({ name: 'received_date', type: 'date' })
  receivedDate: Date;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receivedByUser: User;

  @Column({ name: 'funding_source', length: 100, nullable: true })
  fundingSource: string;

  @Column({ name: 'cost_per_dose', type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPerDose: number;

  @Column({ name: 'ndc_code', length: 20, nullable: true })
  ndcCode: string;

  @Column({ length: 50, default: 'active' })
  status: string;

  @Column({ name: 'recall_information', type: 'text', nullable: true })
  recallInformation: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

