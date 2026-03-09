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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

