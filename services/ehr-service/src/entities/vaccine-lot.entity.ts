import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vaccine_lots')
export class VaccineLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lot_number', length: 50 })
  lotNumber: string;

  @Column({ name: 'vaccine_name', length: 100 })
  vaccineName: string;

  @Column({ length: 100, nullable: true })
  manufacturer: string;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: string;

  @Column({ name: 'quantity_received' })
  quantityReceived: number;

  @Column({ name: 'quantity_remaining' })
  quantityRemaining: number;

  @Column({ name: 'storage_location', length: 100, nullable: true })
  storageLocation: string;

  @Column({ name: 'min_temp_celsius', type: 'numeric', precision: 4, scale: 1, default: 2.0 })
  minTempCelsius: number;

  @Column({ name: 'max_temp_celsius', type: 'numeric', precision: 4, scale: 1, default: 8.0 })
  maxTempCelsius: number;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'NOW()' })
  receivedAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
