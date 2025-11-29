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
    type: 'varchar',
    length: 50,
    enum: ReportType,
  })
  reportType: ReportType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  queryConfig: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  visualizationConfig: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ type: 'text', array: true, default: [] })
  sharedWithRoles: string[];

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'timestamptz', nullable: true })
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

