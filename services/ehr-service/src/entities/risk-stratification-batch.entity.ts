import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('risk_stratification_batches')
export class RiskStratificationBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'total_patients', type: 'int', default: 0 })
  totalPatients: number;

  @Column({ name: 'processed_patients', type: 'int', default: 0 })
  processedPatients: number;

  @Column({ name: 'critical_count', type: 'int', default: 0 })
  criticalCount: number;

  @Column({ name: 'high_count', type: 'int', default: 0 })
  highCount: number;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'running' })
  status: 'running' | 'completed' | 'failed';

  @Column({ name: 'error_log', type: 'text', nullable: true })
  errorLog: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
