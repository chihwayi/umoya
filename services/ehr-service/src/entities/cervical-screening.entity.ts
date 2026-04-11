import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cervical_screenings')
export class CervicalScreening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'screened_by', type: 'uuid' })
  screenedBy: string;

  @Column({ name: 'screened_at', type: 'timestamptz', default: () => 'NOW()' })
  screenedAt: Date;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 30 })
  result: string;

  @Column({ nullable: true })
  acetowhite: boolean | null;

  @Column({ name: 'acetowhite_area_pct', type: 'int', nullable: true })
  acetowhiteAreaPct: number | null;

  @Column({ name: 'lesion_location', length: 30, nullable: true })
  lesionLocation: string | null;

  @Column({ name: 'hpv_genotype', length: 20, nullable: true })
  hpvGenotype: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'next_screening_date', type: 'date', nullable: true })
  nextScreeningDate: string | null;

  @Column({ name: 'language_code', length: 5, default: 'en' })
  languageCode: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
