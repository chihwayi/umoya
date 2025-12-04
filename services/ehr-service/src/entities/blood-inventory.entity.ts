import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('blood_inventory')
export class BloodInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'donation_id' })
  donationId: string;

  @Column({ name: 'component_type', length: 50 })
  componentType: string;

  @Column({ name: 'unit_number', length: 50, unique: true })
  unitNumber: string;

  @Column({ name: 'blood_group', length: 5 })
  bloodGroup: string;

  @Column({ name: 'rh_factor', length: 10 })
  rhFactor: string;

  @Column({ name: 'volume_ml' })
  volumeMl: number;

  @Column({ name: 'collection_date', type: 'date' })
  collectionDate: Date;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ name: 'storage_location', length: 100, nullable: true })
  storageLocation: string;

  @Column({ name: 'storage_temperature', type: 'decimal', precision: 4, scale: 2, nullable: true })
  storageTemperature: number;

  @Column({ length: 50, default: 'available' })
  status: string;

  @Column({ name: 'visual_inspection_passed', default: true })
  visualInspectionPassed: boolean;

  @Column({ name: 'inspection_notes', type: 'text', nullable: true })
  inspectionNotes: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

