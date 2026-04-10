import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chw_visits')
export class ChwVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chw_id', type: 'uuid' })
  chwId: string;

  @Column({ name: 'household_id', type: 'uuid', nullable: true })
  householdId: string | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate: string;

  @Column({ name: 'visit_type', length: 50 })
  visitType: string;

  @Column({ name: 'muac_mm', type: 'int', nullable: true })
  muacMm: number | null;

  @Column({ name: 'muac_classification', length: 10, nullable: true })
  muacClassification: string | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'height_cm', type: 'numeric', precision: 5, scale: 2, nullable: true })
  heightCm: number | null;

  @Column({ name: 'temperature_celsius', type: 'numeric', precision: 4, scale: 1, nullable: true })
  temperatureCelsius: number | null;

  @Column({ name: 'referred_to_facility', default: false })
  referredToFacility: boolean;

  @Column({ name: 'referral_reason', type: 'text', nullable: true })
  referralReason: string | null;

  @Column({ name: 'services_provided', type: 'text', array: true, nullable: true })
  servicesProvided: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'gps_lat', type: 'numeric', precision: 9, scale: 6, nullable: true })
  gpsLat: number | null;

  @Column({ name: 'gps_lng', type: 'numeric', precision: 9, scale: 6, nullable: true })
  gpsLng: number | null;

  @Column({ default: false })
  synced: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
