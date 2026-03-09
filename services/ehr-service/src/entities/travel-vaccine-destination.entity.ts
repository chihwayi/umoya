import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('travel_vaccine_destinations')
export class TravelVaccineDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'country_name', length: 100 })
  countryName: string;

  @Index({ unique: true })
  @Column({ name: 'iso_code', length: 3 })
  isoCode: string;

  @Column({ length: 100, nullable: true })
  region: string | null;

  @Column({ name: 'required_vaccines', type: 'jsonb', default: () => `'[]'::jsonb` })
  requiredVaccines: any[];

  @Column({ name: 'recommended_vaccines', type: 'jsonb', default: () => `'[]'::jsonb` })
  recommendedVaccines: any[];

  @Column({ name: 'malaria_prophylaxis_zones', type: 'jsonb', default: () => `'[]'::jsonb` })
  malariaProphylaxisZones: any[];

  @Column({ name: 'special_notes', type: 'text', nullable: true })
  specialNotes: string | null;

  @Column({ name: 'last_updated', type: 'date', nullable: true })
  lastUpdated: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

