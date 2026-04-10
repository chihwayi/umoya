import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('therapeutic_feeding_records')
export class TherapeuticFeedingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId: string | null;

  @Column({ name: 'feeding_date', type: 'date' })
  feedingDate: string;

  @Column({ name: 'feeding_phase', length: 10 })
  feedingPhase: string;

  @Column({ length: 10 })
  formula: string;

  @Column({ name: 'volume_ml_per_feed', type: 'int', nullable: true })
  volumeMlPerFeed: number | null;

  @Column({ name: 'feeds_per_day', type: 'int', nullable: true })
  feedsPerDay: number | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'noted_by', type: 'uuid', nullable: true })
  notedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
