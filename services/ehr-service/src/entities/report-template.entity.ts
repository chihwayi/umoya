import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { ScheduledReport } from './scheduled-report.entity';
import { ReportExecution } from './report-execution.entity';
import { ReportFavorite } from './report-favorite.entity';

// Forward declaration to avoid circular dependency

export enum ReportType {
  FINANCIAL = 'financial',
  CLINICAL = 'clinical',
  OPERATIONAL = 'operational',
  CUSTOM = 'custom',
}

@Entity('report_templates')
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'report_type',
    type: 'varchar',
    length: 50,
    enum: ReportType,
  })
  @Index('idx_report_templates_report_type')
  reportType: ReportType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index('idx_report_templates_category')
  category?: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, any>;

  @Column({ name: 'query_config', type: 'jsonb', default: {} })
  queryConfig: Record<string, any>;

  @Column({ name: 'visualization_config', type: 'jsonb', default: {} })
  visualizationConfig: Record<string, any>;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index('idx_report_templates_created_by')
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'shared_with_roles', type: 'text', array: true, default: [] })
  sharedWithRoles: string[];

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'last_used', type: 'timestamptz', nullable: true })
  lastUsed?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ScheduledReport, (schedule) => schedule.template)
  scheduledReports: ScheduledReport[];

  @OneToMany(() => ReportExecution, (execution) => execution.reportTemplate)
  executions: ReportExecution[];

  @OneToMany(() => ReportFavorite, (favorite) => favorite.reportTemplate)
  favorites: ReportFavorite[];
}
