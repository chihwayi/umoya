import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('readmission_predictions')
export class ReadmissionPrediction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'discharge_id', type: 'uuid', nullable: true }) dischargeId: string;
  @Column({ name: 'prediction_date', type: 'date' }) predictionDate: string;
  @Column({ name: 'readmission_30_day_risk', type: 'numeric' }) readmission30DayRisk: number; // 0–1
  @Column({ name: 'risk_category', type: 'text' }) riskCategory: string; // low|medium|high
  @Column({ name: 'key_risk_factors', type: 'jsonb', default: '[]' }) keyRiskFactors: any[];
  @Column({ name: 'recommended_followup_interval', type: 'int', nullable: true }) recommendedFollowupInterval: number; // days
  @Column({ name: 'prediction_model', type: 'text', nullable: true }) predictionModel: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
