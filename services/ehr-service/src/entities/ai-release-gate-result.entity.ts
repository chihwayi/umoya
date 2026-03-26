import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_release_gate_results')
@Index('idx_ai_release_gate_results_surface_gate', ['aiSurface', 'gateName'])
@Index('idx_ai_release_gate_results_status', ['gateStatus'])
export class AiReleaseGateResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'eval_run_id', type: 'uuid', nullable: true })
  evalRunId: string | null;

  @Column({ name: 'ai_surface', type: 'varchar', length: 80 })
  aiSurface: string;

  @Column({ name: 'gate_name', type: 'varchar', length: 80 })
  gateName: string;

  @Column({ name: 'gate_status', type: 'varchar', length: 30, default: 'passed' })
  gateStatus: string;

  @Column({ name: 'comparator', type: 'varchar', length: 12, nullable: true })
  comparator: string | null;

  @Column({ name: 'observed_value', type: 'float', nullable: true })
  observedValue: number | null;

  @Column({ name: 'threshold_value', type: 'float', nullable: true })
  thresholdValue: number | null;

  @Column({ name: 'details', type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
