import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('patient_early_warning_scores')
export class PatientEarlyWarningScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId: string | null;

  @Column({
    name: 'score_type',
    length: 20,
    default: 'NEWS2',
  })
  scoreType: 'NEWS2' | 'MEWS' | 'PEWS';

  @Column({ name: 'total_score', type: 'int' })
  totalScore: number;

  @Index()
  @Column({ name: 'risk_level', length: 20, nullable: true })
  riskLevel: 'low' | 'low_medium' | 'medium' | 'high' | null;

  @Column({ name: 'component_scores', type: 'jsonb' })
  componentScores: Record<string, any>;

  @Column({ name: 'vitals_id', type: 'uuid', nullable: true })
  vitalsId: string | null;

  @Column({ name: 'calculated_at', type: 'timestamptz', default: () => 'NOW()' })
  calculatedAt: Date;

  @Column({ name: 'alert_triggered', default: false })
  alertTriggered: boolean;

  @Column({ name: 'alert_acknowledged_by', type: 'uuid', nullable: true })
  alertAcknowledgedBy: string | null;

  @Column({ name: 'alert_acknowledged_at', type: 'timestamptz', nullable: true })
  alertAcknowledgedAt: Date | null;

  @Column({ name: 'news2_components', type: 'jsonb', nullable: true })
  news2Components: Record<string, number> | null;

  @Column({ name: 'deterioration_probability', type: 'numeric', precision: 5, scale: 4, nullable: true })
  deteriorationProbability: number | null;

  @Column({ name: 'deterioration_risk_horizon', type: 'int', nullable: true })
  deteriorationRiskHorizon: number | null;

  @Column({ name: 'ml_interventions', type: 'jsonb', default: '[]' })
  mlInterventions: any[];

  @Column({ name: 'ml_confidence', type: 'numeric', precision: 5, scale: 4, nullable: true })
  mlConfidence: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

