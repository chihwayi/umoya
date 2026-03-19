import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Patient } from './patient.entity';

/**
 * AI-generated pre-chart for an upcoming appointment.
 * The precharter cron populates this 25–35 min before each appointment.
 *
 * Provisioned in Sprint 64 — provision-sprint64-pre-charting.ts
 */
@Entity('encounter_precharts')
export class EncounterPrechart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id', type: 'uuid', unique: true })
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: Appointment;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'NOW()' })
  generatedAt: Date;

  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary?: string;

  @Column({ name: 'active_problems', type: 'jsonb', default: '[]' })
  activeProblems: any[];

  @Column({ name: 'current_medications', type: 'jsonb', default: '[]' })
  currentMedications: any[];

  @Column({ type: 'jsonb', default: '[]' })
  allergies: any[];

  @Column({ name: 'outstanding_care_gaps', type: 'jsonb', default: '[]' })
  outstandingCareGaps: any[];

  @Column({ name: 'suggested_agenda', type: 'jsonb', default: '[]' })
  suggestedAgenda: any[];

  @Column({ name: 'risk_flags', type: 'jsonb', default: '[]' })
  riskFlags: any[];

  @Column({ name: 'last_lab_abnormalities', type: 'jsonb', default: '[]' })
  lastLabAbnormalities: any[];

  @Column({ name: 'last_imaging_findings', type: 'jsonb', default: '[]' })
  lastImagingFindings: any[];

  @Column({ name: 'provider_reviewed', type: 'boolean', default: false })
  providerReviewed: boolean;

  @Column({ name: 'provider_reviewed_at', type: 'timestamptz', nullable: true })
  providerReviewedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
