import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TelemedicineConsultation } from './telemedicine-consultation.entity';
import { User } from './user.entity';

export type LogType = 'connection_issue' | 'audio_issue' | 'video_issue' | 'bandwidth_issue' | 'other';
export type LogSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('telemedicine_technical_logs')
export class TelemedicineTechnicalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TelemedicineConsultation, consultation => consultation.technicalLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultation_id' })
  consultation: TelemedicineConsultation;

  @Column({ name: 'consultation_id', type: 'uuid' })
  consultationId: string;

  @Column({ name: 'log_type', type: 'varchar', length: 30 })
  logType: LogType;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: LogSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedBy?: User;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedById?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

