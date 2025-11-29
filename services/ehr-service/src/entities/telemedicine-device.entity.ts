import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type DeviceType = 'smartphone' | 'tablet' | 'laptop' | 'desktop';
export type InternetConnectionType = 'wifi' | 'mobile_data' | 'ethernet' | 'unknown';

@Entity('telemedicine_devices')
export class TelemedicineDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'device_type', type: 'varchar', length: 20 })
  deviceType: DeviceType;

  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  deviceName?: string;

  @Column({ name: 'operating_system', type: 'varchar', length: 50, nullable: true })
  operatingSystem?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  browser?: string;

  @Column({ name: 'browser_version', type: 'varchar', length: 50, nullable: true })
  browserVersion?: string;

  @Column({ name: 'internet_connection_type', type: 'varchar', length: 20, nullable: true })
  internetConnectionType?: InternetConnectionType;

  @Column({ name: 'average_bandwidth', type: 'integer', nullable: true })
  averageBandwidth?: number;

  @Column({ name: 'last_used', type: 'timestamptz', nullable: true })
  lastUsed?: Date;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

