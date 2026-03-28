import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_recommendation_audits')
export class AiRecommendationAudit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'decision_log_id', type: 'uuid', nullable: true }) decisionLogId: string;
  @Column({ name: 'recommendation_type', type: 'text' }) recommendationType: string; // diagnosis|drug|coding|deterioration|readmission|scheduling|formulary
  @Column({ name: 'patient_id', type: 'uuid', nullable: true }) patientId: string;
  @Column({ type: 'numeric', nullable: true }) confidence: number;
  @Column({ type: 'text', nullable: true }) reasoning: string;
  @Column({ type: 'jsonb', default: '[]' }) evidence: any[]; // [{source, section, strength}]
  @Column({ type: 'jsonb', default: '[]' }) alternatives: any[];
  @Column({ name: 'override_logged', type: 'boolean', default: false }) overrideLogged: boolean;
  @Column({ name: 'override_reason', type: 'text', nullable: true }) overrideReason: string;
  @Column({ name: 'override_by', type: 'uuid', nullable: true }) overrideBy: string;
  @Column({ name: 'displayed_to_user', type: 'boolean', default: false }) displayedToUser: boolean;
  @Column({ name: 'user_read_at', type: 'timestamptz', nullable: true }) userReadAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
