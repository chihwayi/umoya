import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyDispensing } from './pharmacy-dispensing.entity';
import { PharmacyDispensingItem } from './pharmacy-dispensing-item.entity';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('pharmacy_dispensing_anomalies')
export class PharmacyDispensingAnomaly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyDispensing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispensing_id' })
  dispensing: PharmacyDispensing;

  @Column({ name: 'dispensing_id', type: 'uuid' })
  dispensingId: string;

  @ManyToOne(() => PharmacyDispensingItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispensing_item_id' })
  dispensingItem: PharmacyDispensingItem;

  @Column({ name: 'dispensing_item_id', type: 'uuid' })
  dispensingItemId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId?: string | null;

  @ManyToOne(() => PharmacyInventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy?: User;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById?: string | null;

  @Column({ name: 'anomaly_type', type: 'varchar', length: 40 })
  anomalyType: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: string;

  @Column({ name: 'anomaly_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  anomalyScore: number;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'medication_name', type: 'varchar', length: 255 })
  medicationName: string;

  @Column({ type: 'text' })
  rationale: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
