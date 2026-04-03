import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index
} from 'typeorm';

@Entity('patient_ai_snapshots')
@Index(['patientId'])
export class PatientAiSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  // One-line clinical summary for chart header
  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary: string;

  // Full structured AI analysis payload
  @Column({ name: 'analysis_payload', type: 'jsonb', nullable: true })
  analysisPayload: Record<string, any>;

  // Risk scores: { sepsis: 0.78, deterioration: 0.45, fall: 0.12, readmission: 0.71 }
  @Column({ name: 'risk_scores', type: 'jsonb', nullable: true })
  riskScores: Record<string, number>;

  // Active flags: ["hiv_no_art", "missed_anc", "critical_bp"]
  @Column({ name: 'active_flags', type: 'jsonb', nullable: true })
  activeFlags: string[];

  // Top 3 guideline citations used in analysis
  @Column({ name: 'guideline_citations', type: 'jsonb', nullable: true })
  guidelineCitations: any[];

  // Which trigger fired this snapshot: chart_open | vitals | labs | admission | batch | manual
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  // NEWS2 score at time of snapshot
  @Column({ name: 'news2_score', type: 'int', nullable: true })
  news2Score: number;

  // qSOFA score
  @Column({ name: 'qsofa_score', type: 'int', nullable: true })
  qsofaScore: number;

  // Model used for this snapshot
  @Column({ name: 'model_version', type: 'varchar', length: 80, nullable: true })
  modelVersion: string;

  @Column({ name: 'snapshot_generated_at', type: 'timestamptz', default: () => 'NOW()' })
  snapshotGeneratedAt: Date;

  @Column({ name: 'triggered_by_user_id', type: 'uuid', nullable: true })
  triggeredByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
