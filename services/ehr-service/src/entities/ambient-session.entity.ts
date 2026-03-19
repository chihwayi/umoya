import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

/**
 * Persists every ambient AI consultation session.
 * The real-time WebSocket gateway writes to this entity as audio is processed.
 *
 * Provisioned in Sprint 63 — provision-sprint63-ambient-ai.ts
 */
@Entity('ambient_sessions')
export class AmbientSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider?: User;

  /** active | paused | completed | failed */
  @Column({ length: 20, default: 'active' })
  status: string = 'active';

  /** MinIO object key for raw audio archive */
  @Column({ name: 'audio_storage_key', type: 'text', nullable: true })
  audioStorageKey?: string;

  /** Full raw transcript assembled from all chunks */
  @Column({ name: 'transcript_raw', type: 'text', nullable: true })
  transcriptRaw?: string;

  /**
   * Extracted entities: diagnoses, medications, allergies, vitals mentioned.
   * Shape: { diagnoses: [...], medications: [...], allergies: [...], vitals: [...] }
   */
  @Column({ name: 'structured_output', type: 'jsonb', default: {} })
  structuredOutput: Record<string, any> = {};

  /**
   * AI-pre-filled SOAP note fields.
   * Shape: { subjective: '', objective: '', assessment: '', plan: '' }
   */
  @Column({ name: 'draft_note', type: 'jsonb', default: {} })
  draftNote: Record<string, any> = {};

  /** AI-suggested orders derived from the conversation */
  @Column({ name: 'ai_suggested_orders', type: 'jsonb', default: [] })
  aiSuggestedOrders: Array<Record<string, any>> = [];

  /** AI-suggested diagnoses with confidence scores */
  @Column({ name: 'ai_suggested_diagnoses', type: 'jsonb', default: [] })
  aiSuggestedDiagnoses: Array<Record<string, any>> = [];

  /** Real-time alerts raised (drug interactions, critical vitals, allergy conflicts) */
  @Column({ name: 'alerts_raised', type: 'jsonb', default: [] })
  alertsRaised: Array<Record<string, any>> = [];

  /**
   * Which AI suggestions the provider accepted/dismissed.
   * Shape: { orders: { [id]: 'accepted'|'dismissed' }, diagnoses: { [id]: 'accepted'|'dismissed' } }
   */
  @Column({ name: 'provider_accepted_fields', type: 'jsonb', default: {} })
  providerAcceptedFields: Record<string, any> = {};

  @Column({ name: 'session_started_at', type: 'timestamptz', default: () => 'NOW()' })
  sessionStartedAt: Date;

  @Column({ name: 'session_ended_at', type: 'timestamptz', nullable: true })
  sessionEndedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
