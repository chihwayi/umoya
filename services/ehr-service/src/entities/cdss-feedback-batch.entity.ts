import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cdss_feedback_batches')
export class CdssFeedbackBatch {
  @PrimaryGeneratedColumn('uuid', { name: 'batch_id' })
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'feedback_count', type: 'int', default: 0 })
  feedbackCount: number;

  @Column({ type: 'varchar', length: 30, default: 'pending_review' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
