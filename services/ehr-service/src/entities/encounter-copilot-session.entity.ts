import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('encounter_copilot_sessions')
@Index('idx_encounter_copilot_sessions_patient_created', ['patientId', 'createdAt'])
@Index('idx_encounter_copilot_sessions_appointment', ['appointmentId'])
@Index('idx_encounter_copilot_sessions_status', ['status'])
export class EncounterCopilotSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string | null;

  @Column({ name: 'ambient_session_id', type: 'uuid', nullable: true })
  ambientSessionId: string | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy: string | null;

  @Column({ name: 'encounter_type', type: 'varchar', length: 50, nullable: true })
  encounterType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  specialty: string | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ type: 'varchar', length: 30, default: 'generated' })
  status: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'active_problems', type: 'jsonb', default: () => "'[]'::jsonb" })
  activeProblems: Array<Record<string, any>>;

  @Column({ name: 'missing_context', type: 'jsonb', default: () => "'[]'::jsonb" })
  missingContext: Array<Record<string, any>>;

  @Column({ name: 'suggested_orders', type: 'jsonb', default: () => "'[]'::jsonb" })
  suggestedOrders: Array<Record<string, any>>;

  @Column({ name: 'likely_care_gaps', type: 'jsonb', default: () => "'[]'::jsonb" })
  likelyCareGaps: Array<Record<string, any>>;

  @Column({ name: 'contraindication_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  contraindicationSummary: Record<string, any>;

  @Column({ name: 'pathway_recommendations', type: 'jsonb', default: () => "'[]'::jsonb" })
  pathwayRecommendations: Array<Record<string, any>>;

  @Column({ name: 'specialty_contributors', type: 'jsonb', default: () => "'[]'::jsonb" })
  specialtyContributors: Array<Record<string, any>>;

  @Column({ name: 'encounter_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  encounterSnapshot: Record<string, any>;

  @Column({ name: 'governance', type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceScore: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
