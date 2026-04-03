import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index
} from 'typeorm';

export enum AlertSeverity {
  CRITICAL = 'critical',   // Requires immediate action (red)
  HIGH = 'high',           // Requires action this visit (orange)
  MEDIUM = 'medium',       // Should be addressed (yellow)
  LOW = 'low',             // Informational (blue)
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  ACTIONED = 'actioned',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired',
}

export enum AlertCategory {
  SEPSIS = 'sepsis',
  DRUG_INTERACTION = 'drug_interaction',
  CRITICAL_VALUE = 'critical_value',
  CARE_GAP = 'care_gap',
  DETERIORATION = 'deterioration',
  ALLERGY = 'allergy',
  TREATMENT_GAP = 'treatment_gap',
  MISSED_FOLLOWUP = 'missed_followup',
  HIGH_RISK_MED = 'high_risk_med',
  LAB_ABNORMAL = 'lab_abnormal',
  VITALS_ABNORMAL = 'vitals_abnormal',
  GUIDELINE_DEVIATION = 'guideline_deviation',
  PREECLAMPSIA = 'preeclampsia',
  READMISSION_RISK = 'readmission_risk',
  COINFECTION = 'coinfection',
}

@Entity('proactive_alerts')
@Index(['patientId', 'status'])
@Index(['tenantId', 'status', 'severity'])
@Index(['targetUserId', 'status'])
export class ProactiveAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'category', type: 'varchar', length: 60 })
  category: AlertCategory;

  @Column({ name: 'severity', type: 'varchar', length: 20, default: AlertSeverity.MEDIUM })
  severity: AlertSeverity;

  @Column({ name: 'status', type: 'varchar', length: 30, default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  // Recommended action for the clinician
  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string;

  // Guideline reference that backs this alert
  @Column({ name: 'guideline_reference', type: 'varchar', length: 300, nullable: true })
  guidelineReference: string;

  // Raw data that triggered this alert (e.g. the vitals that caused sepsis flag)
  @Column({ name: 'trigger_data', type: 'jsonb', nullable: true })
  triggerData: Record<string, any>;

  // Which trigger type: vitals | labs | prescription | chart_open | batch | admission
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  // Target user to notify (null = all clinical staff for this patient)
  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string;

  // Confidence score from CDSS (0.0 - 1.0)
  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidenceScore: number;

  // Auto-expire after this time if not acknowledged
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ name: 'acknowledged_by_id', type: 'uuid', nullable: true })
  acknowledgedById: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string;

  // Deduplication key — prevents re-alerting on same condition
  @Column({ name: 'dedup_key', type: 'varchar', length: 200, nullable: true })
  @Index()
  dedupKey: string;

  @Column({ name: 'is_suppressed', type: 'boolean', default: false })
  isSuppressed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
