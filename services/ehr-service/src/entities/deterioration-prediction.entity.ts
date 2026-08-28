import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('deterioration_predictions')
export class DeteriorationPrediction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'admission_id', type: 'uuid', nullable: true }) admissionId: string;
  @Column({ name: 'prediction_time', type: 'timestamptz' }) predictionTime: Date;
  @Column({ name: 'deterioration_score', type: 'numeric' }) deteriorationScore: number; // 0–100
  @Column({ name: 'predicted_event_type', type: 'text', nullable: true }) predictedEventType: string; // sepsis|respiratory_failure|cardiac_arrest|AKI
  @Column({ name: 'predicted_timeframe_hours', type: 'int', nullable: true }) predictedTimeframeHours: number;
  @Column({ name: 'feature_contributions', type: 'jsonb', default: '{}' }) featureContributions: Record<string, any>;
  @Column({ name: 'triggered_alert', type: 'boolean', default: false }) triggeredAlert: boolean;
  @Column({ name: 'model_used', type: 'varchar', length: 50, nullable: true, default: 'MEWS' }) modelUsed: string;

  // S278 — patient-specific trend/rate-of-change lookahead, computed from windowed
  // vitals history. Distinct from (and additive to) the static MEWS-band timeframe
  // estimate above. Honestly labeled — trend extrapolation, not an ML prediction.
  @Column({ name: 'trend_direction', type: 'varchar', length: 20, nullable: true }) trendDirection: string | null; // worsening|stable|improving|insufficient_data
  @Column({ name: 'trend_method', type: 'varchar', length: 30, default: 'linear_extrapolation' }) trendMethod: string;
  @Column({ name: 'projected_hours_to_critical', type: 'int', nullable: true }) projectedHoursToCritical: number | null;
  @Column({ name: 'trend_details', type: 'jsonb', default: '{}' }) trendDetails: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
