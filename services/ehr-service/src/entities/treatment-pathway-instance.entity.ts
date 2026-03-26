import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('treatment_pathway_instances')
@Index('idx_treatment_pathway_instances_session_rank', ['encounterCopilotSessionId', 'recommendationRank'])
@Index('idx_treatment_pathway_instances_patient_status', ['patientId', 'status'])
@Index('idx_treatment_pathway_instances_pathway', ['pathwayId'])
export class TreatmentPathwayInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'encounter_copilot_session_id', type: 'uuid' })
  encounterCopilotSessionId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'pathway_id', type: 'uuid', nullable: true })
  pathwayId: string | null;

  @Column({ name: 'pathway_code', type: 'varchar', length: 100, nullable: true })
  pathwayCode: string | null;

  @Column({ name: 'pathway_name', type: 'varchar', length: 255 })
  pathwayName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  specialty: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  condition: string | null;

  @Column({ name: 'recommendation_rank', type: 'int', default: 1 })
  recommendationRank: number;

  @Column({ name: 'recommendation_reason', type: 'text' })
  recommendationReason: string;

  @Column({ type: 'varchar', length: 30, default: 'recommended' })
  status: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
