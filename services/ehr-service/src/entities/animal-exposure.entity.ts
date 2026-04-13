import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('animal_exposures')
export class AnimalExposure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @Column({ name: 'recorded_date', type: 'date' })
  recordedDate: string;

  @Column({ name: 'animal_type', type: 'text' })
  animalType: string;

  @Column({ name: 'exposure_type', type: 'text' })
  exposureType: string;

  @Column({ name: 'exposure_date', type: 'date', nullable: true })
  exposureDate: string | null;

  @Column({ name: 'exposure_location', type: 'text', nullable: true })
  exposureLocation: string | null;

  @Column({ name: 'animal_ill', type: 'boolean', nullable: true })
  animalIll: boolean | null;

  @Column({ name: 'animal_vaccinated', type: 'boolean', nullable: true })
  animalVaccinated: boolean | null;

  @Column({ name: 'rabies_pep_started', type: 'boolean', default: false })
  rabiesPepStarted: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
