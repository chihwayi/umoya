import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ebs_signals' })
export class EbsSignal {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'signal_source', type: 'text' }) signalSource: string;

  @Column({ name: 'signal_type', type: 'text' }) signalType: string;

  @Column({ name: 'disease_suspected', type: 'text', nullable: true }) diseaseSuspected: string | null;

  @Column({ name: 'district', type: 'text', nullable: true }) district: string | null;

  @Column({ name: 'village_area', type: 'text', nullable: true }) villageArea: string | null;

  @Column({ name: 'description', type: 'text' }) description: string;

  @Column({ name: 'raw_source_text', type: 'text', nullable: true }) rawSourceText: string | null;

  @Column({ name: 'triage_status', type: 'text', default: 'unverified' }) triageStatus: string;

  @Column({ name: 'triage_by', type: 'uuid', nullable: true }) triageBy: string | null;

  @Column({ name: 'triage_at', type: 'timestamp', nullable: true }) triageAt: Date | null;

  @Column({ name: 'cdss_risk_level', type: 'text', nullable: true }) cdssRiskLevel: string | null;

  @Column({ name: 'cdss_recommended_action', type: 'text', nullable: true }) cdssRecommendedAction: string | null;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number | null;

  @Column({ name: 'investigation_started_at', type: 'timestamp', nullable: true }) investigationStartedAt: Date | null;

  @Column({ name: 'investigation_outcome', type: 'text', nullable: true }) investigationOutcome: string | null;

  @Column({ name: 'linked_ihr_notification_id', type: 'uuid', nullable: true }) linkedIhrNotificationId: string | null;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true }) reportedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
}
