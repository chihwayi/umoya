import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sdg_indicator_targets' })
export class SdgIndicatorTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'indicator_code', unique: true })
  indicatorCode: string;

  @Column({ name: 'indicator_name' })
  indicatorName: string;

  @Column({ name: 'sdg_goal' })
  sdgGoal: string;

  @Column({ name: 'target_value', type: 'decimal', precision: 8, scale: 2 })
  targetValue: number;

  @Column({ name: 'target_year', default: 2030 })
  targetYear: number;

  @Column({ name: 'national_target', type: 'decimal', precision: 8, scale: 2, nullable: true })
  nationalTarget: number | null;

  @Column({ name: 'unit', default: 'percentage' })
  unit: string;

  @Column({ name: 'data_source', nullable: true })
  dataSource: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
