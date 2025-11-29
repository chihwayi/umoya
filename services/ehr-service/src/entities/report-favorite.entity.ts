import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { ReportTemplate } from './report-template.entity';

@Entity('report_favorites')
@Unique(['userId', 'reportTemplateId'])
export class ReportFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'report_template_id', type: 'uuid' })
  reportTemplateId: string;

  @ManyToOne(() => ReportTemplate)
  @JoinColumn({ name: 'report_template_id' })
  reportTemplate: ReportTemplate;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customName?: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

