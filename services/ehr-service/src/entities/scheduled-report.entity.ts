import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { ReportTemplate } from './report-template.entity';
import { ReportExecution } from './report-execution.entity';

export enum ScheduleType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

@Entity('scheduled_reports')
export class ScheduledReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @ManyToOne(() => ReportTemplate, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: ReportTemplate;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ScheduleType,
  })
  scheduleType: ScheduleType;

  @Column({ type: 'jsonb', default: {} })
  scheduleConfig: Record<string, any>;

  @Column({ type: 'text', array: true, default: [] })
  recipients: string[];

  @Column({ type: 'text', array: true, default: [] })
  recipientRoles: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: ReportFormat.PDF,
    enum: ReportFormat,
  })
  format: ReportFormat;

  @Column({ type: 'jsonb', default: {} })
  filters: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastRun?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextRun?: Date;

  @Column({ type: 'int', default: 0 })
  runCount: number;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ReportExecution, (execution) => execution.scheduledReport)
  executions: ReportExecution[];
}

