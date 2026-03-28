import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { ReportTemplate } from './report-template.entity';
import { ScheduledReport } from './scheduled-report.entity';

export enum ExecutionType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  API = 'api',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('report_executions')
export class ReportExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_template_id', type: 'uuid', nullable: true })
  @Index('idx_report_executions_template_id')
  reportTemplateId?: string;

  @ManyToOne(() => ReportTemplate, { nullable: true })
  @JoinColumn({ name: 'report_template_id' })
  reportTemplate?: ReportTemplate;

  @Column({ name: 'scheduled_report_id', type: 'uuid', nullable: true })
  @Index('idx_report_executions_scheduled_id')
  scheduledReportId?: string;

  @ManyToOne(() => ScheduledReport, { nullable: true })
  @JoinColumn({ name: 'scheduled_report_id' })
  scheduledReport?: ScheduledReport;

  @Column({
    name: 'execution_type',
    type: 'varchar',
    length: 20,
    enum: ExecutionType,
  })
  executionType: ExecutionType;

  @Column({ name: 'executed_by', type: 'uuid', nullable: true })
  @Index('idx_report_executions_executed_by')
  executedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'executed_by' })
  executedBy?: User;

  @Column({ name: 'execution_time', type: 'timestamptz', default: () => 'NOW()' })
  @Index('idx_report_executions_execution_time')
  executionTime: Date;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: ExecutionStatus.PENDING,
    enum: ExecutionStatus,
  })
  @Index('idx_report_executions_status')
  status: ExecutionStatus;

  @Column({ name: 'filters_applied', type: 'jsonb', default: {} })
  filtersApplied: Record<string, any>;

  @Column({ name: 'result_count', type: 'int', nullable: true })
  resultCount?: number;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

