import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Durable audit record of a nurse's Accept/Modify/Reject response to an AI
// Copilot recommendation (triage/vitals/notes/handoff). Before this entity,
// POST /cdss/copilot/action only incremented an aggregate metric — there was
// no way to look up which clinician responded to which recommendation, when,
// or why. See CdssService.recordCopilotAction().
@Entity({ name: 'copilot_decisions' })
export class CopilotDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'copilot_type', type: 'varchar', length: 20 })
  copilotType: 'triage' | 'vitals' | 'notes' | 'handoff';

  @Column({ type: 'varchar', length: 20 })
  decision: 'accept' | 'modify' | 'reject';

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'recommendation_summary', type: 'text', nullable: true })
  recommendationSummary?: string;

  @Column({ name: 'model_version', type: 'varchar', length: 100, nullable: true })
  modelVersion?: string;

  @Column({ name: 'prompt_context_hash', type: 'varchar', length: 64, nullable: true })
  promptContextHash?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
