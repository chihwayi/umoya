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
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
