import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('headache_diaries')
export class HeadacheDiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'entry_date', type: 'timestamptz', default: () => 'now()' })
  entryDate: Date;

  @Column({ name: 'headache_type', type: 'text', nullable: true })
  headacheType: string | null;

  @Column({ name: 'severity_vas', type: 'int', nullable: true })
  severityVas: number | null;

  @Column({ name: 'duration_hours', type: 'numeric', precision: 6, scale: 1, nullable: true })
  durationHours: number | null;

  @Column({ type: 'jsonb', default: [] })
  triggers: any[];

  @Column({ name: 'aura_present', type: 'boolean', default: false })
  auraPresent: boolean;

  @Column({ name: 'aura_features', type: 'jsonb', default: [] })
  auraFeatures: any[];

  @Column({ name: 'medication_used', type: 'text', nullable: true })
  medicationUsed: string | null;

  @Column({ name: 'hit6_score', type: 'int', nullable: true })
  hit6Score: number | null;

  @Column({ name: 'disability_level', type: 'text', nullable: true })
  disabilityLevel: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
