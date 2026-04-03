import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('patient_risk_scores')
@Index(['patientId', 'scoredAt'])
@Index(['tenantId', 'scoreType'])
export class PatientRiskScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  // Type: sepsis | deterioration | fall | readmission | preeclampsia | news2 | qsofa
  @Column({ name: 'score_type', type: 'varchar', length: 60 })
  scoreType: string;

  @Column({ name: 'score_value', type: 'decimal', precision: 5, scale: 4 })
  scoreValue: number;

  // Risk level derived from score: low | medium | high | critical
  @Column({ name: 'risk_level', type: 'varchar', length: 20 })
  riskLevel: string;

  // The raw data inputs that produced this score
  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData: Record<string, any>;

  // Trigger: vitals | labs | batch | chart_open | admission
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  @Column({ name: 'model_version', type: 'varchar', length: 80, nullable: true })
  modelVersion: string;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string;

  @Column({ name: 'scored_at', type: 'timestamptz', default: () => 'NOW()' })
  scoredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
