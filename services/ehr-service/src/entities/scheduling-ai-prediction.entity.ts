import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scheduling_ai_predictions')
export class SchedulingAiPrediction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'appointment_id', type: 'uuid' }) appointmentId: string;
  @Column({ name: 'no_show_probability', type: 'numeric' }) noShowProbability: number;
  @Column({ name: 'cancel_probability', type: 'numeric' }) cancelProbability: number;
  @Column({ name: 'recommended_duration', type: 'int', nullable: true }) recommendedDuration: number;
  @Column({ name: 'confidence_score', type: 'numeric' }) confidenceScore: number;
  @Column({ name: 'feature_importance', type: 'jsonb', default: '{}' }) featureImportance: Record<string, any>;
  @Column({ type: 'text', nullable: true }) model: string;
  @Column({ name: 'prediction_date', type: 'timestamptz' }) predictionDate: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
