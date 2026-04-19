import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'cross_border_patient_flags' })
export class CrossBorderPatientFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId: string;

  @Column({ name: 'origin_country', type: 'text' })
  originCountry: string;

  @Column({ name: 'current_country', type: 'text' })
  currentCountry: string;

  @Column({ name: 'cross_border_reason', type: 'text', nullable: true })
  crossBorderReason: string | null;

  @Column({ name: 'foreign_art_number', type: 'text', nullable: true })
  foreignArtNumber: string | null;

  @Column({ name: 'foreign_facility', type: 'text', nullable: true })
  foreignFacility: string | null;

  @Column({ name: 'last_foreign_visit_date', type: 'date', nullable: true })
  lastForeignVisitDate: string | null;

  @Column({ name: 'art_history_imported', type: 'boolean', default: false })
  artHistoryImported: boolean;

  @Column({ name: 'vl_history_imported', type: 'boolean', default: false })
  vlHistoryImported: boolean;

  @Column({ name: 'continuity_gap_detected', type: 'boolean', default: false })
  continuityGapDetected: boolean;

  @Column({ name: 'continuity_notes', type: 'text', nullable: true })
  continuityNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
