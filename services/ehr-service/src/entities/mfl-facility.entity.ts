import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('mfl_facilities')
export class MflFacility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mfl_code', length: 20, unique: true })
  mflCode: string;

  @Column({ name: 'facility_name', length: 255 })
  facilityName: string;

  @Column({ length: 100, nullable: true })
  county: string | null;

  @Column({ name: 'sub_county', length: 100, nullable: true })
  subCounty: string | null;

  @Column({ name: 'facility_type', length: 100, nullable: true })
  facilityType: string | null;

  @Column({ length: 100, nullable: true })
  ownership: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  latitude: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  longitude: number | null;

  @Column({ length: 30, nullable: true })
  phone: string | null;

  @Column({ length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'raw_data', type: 'jsonb', default: () => "'{}'" })
  rawData: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
