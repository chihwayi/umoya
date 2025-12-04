import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('medication_barcode_master')
export class MedicationBarcodeMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'generic_name', length: 255, nullable: true })
  genericName: string;

  @Column({ name: 'brand_name', length: 255, nullable: true })
  brandName: string;

  @Column({ length: 100, unique: true })
  barcode: string;

  @Column({ name: 'ndc_code', length: 20, nullable: true })
  ndcCode: string;

  @Column({ length: 100, nullable: true })
  strength: string;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ length: 100, nullable: true })
  form: string;

  @Column({ length: 50, nullable: true })
  route: string;

  @Column({ length: 255, nullable: true })
  manufacturer: string;

  @Column({ name: 'is_high_alert', default: false })
  isHighAlert: boolean;

  @Column({ name: 'is_controlled', default: false })
  isControlled: boolean;

  // Safety Information
  @Column({ name: 'look_alike_sound_alike', type: 'jsonb', default: [] })
  lookAlikeSoundAlike: any[];

  @Column({ type: 'text', nullable: true })
  contraindications: string;

  @Column({ name: 'allergies_to_check', type: 'jsonb', default: [] })
  allergiesToCheck: any[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

