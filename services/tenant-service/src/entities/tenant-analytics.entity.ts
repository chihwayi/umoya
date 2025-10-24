import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export enum MetricType {
  USERS = 'users',
  PATIENTS = 'patients',
  APPOINTMENTS = 'appointments',
  REVENUE = 'revenue',
  STORAGE_USED = 'storage_used',
  API_CALLS = 'api_calls',
  LOGIN_COUNT = 'login_count'
}

@Entity('tenant_analytics')
export class TenantAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: MetricType
  })
  metricType: MetricType;

  @Column('decimal', { precision: 15, scale: 2 })
  value: number;

  @Column('date')
  recordDate: Date;

  @Column({ nullable: true })
  metadata: string; // JSON string for additional data

  @CreateDateColumn()
  createdAt: Date;
}