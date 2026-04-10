import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'household_code', length: 30, unique: true })
  householdCode: string;

  @Column({ name: 'head_of_household', length: 200, nullable: true })
  headOfHousehold: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ length: 100, nullable: true })
  village: string | null;

  @Column({ length: 100, nullable: true })
  ward: string | null;

  @Column({ length: 100, nullable: true })
  district: string | null;

  @Column({ name: 'gps_lat', type: 'numeric', precision: 9, scale: 6, nullable: true })
  gpsLat: number | null;

  @Column({ name: 'gps_lng', type: 'numeric', precision: 9, scale: 6, nullable: true })
  gpsLng: number | null;

  @Column({ name: 'water_source', length: 50, nullable: true })
  waterSource: string | null;

  @Column({ name: 'sanitation_type', length: 50, nullable: true })
  sanitationType: string | null;

  @Column({ name: 'assigned_chw_id', type: 'uuid', nullable: true })
  assignedChwId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
