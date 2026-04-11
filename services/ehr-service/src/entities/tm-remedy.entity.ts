import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tm_remedies')
export class TmRemedy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' }) recordedAt: Date;
  @Column({ name: 'remedy_name', length: 200 }) remedyName: string;
  @Column({ name: 'scientific_name', length: 200, nullable: true }) scientificName: string | null;
  @Column({ length: 50, nullable: true }) preparation: string | null;
  @Column({ length: 30, default: 'oral' }) route: string;
  @Column({ name: 'dose_description', type: 'text', nullable: true }) doseDescription: string | null;
  @Column({ length: 50, nullable: true }) frequency: string | null;
  @Column({ name: 'duration_days', type: 'int', nullable: true }) durationDays: number | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ length: 50, nullable: true }) source: string | null;
  @Column({ name: 'icd11_tm2_code', length: 30, nullable: true }) icd11Tm2Code: string | null;
  @Column({ name: 'snomed_concept_id', length: 30, nullable: true }) snomedConceptId: string | null;
  @Column({ name: 'is_disclosed', type: 'boolean', default: true }) isDisclosed: boolean;
  @Column({ name: 'is_ongoing', type: 'boolean', default: true }) isOngoing: boolean;
  @Column({ name: 'stopped_at', type: 'date', nullable: true }) stoppedAt: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
