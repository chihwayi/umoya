import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_eval_runs')
@Index('idx_ai_eval_runs_surface_created', ['aiSurface', 'createdAt'])
@Index('idx_ai_eval_runs_status', ['runStatus'])
export class AiEvalRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ai_surface', type: 'varchar', length: 80 })
  aiSurface: string;

  @Column({ name: 'model_name', type: 'varchar', length: 80, nullable: true })
  modelName: string | null;

  @Column({ name: 'case_set_name', type: 'varchar', length: 120 })
  caseSetName: string;

  @Column({ name: 'dataset_version', type: 'varchar', length: 80 })
  datasetVersion: string;

  @Column({ name: 'run_status', type: 'varchar', length: 30, default: 'passed' })
  runStatus: string;

  @Column({ name: 'total_cases', type: 'int', default: 0 })
  totalCases: number;

  @Column({ name: 'report_path', type: 'text', nullable: true })
  reportPath: string | null;

  @Column({ name: 'retrieval_recall_at_k', type: 'float', nullable: true })
  retrievalRecallAtK: number | null;

  @Column({ name: 'retrieval_hit_rate_at_k', type: 'float', nullable: true })
  retrievalHitRateAtK: number | null;

  @Column({ name: 'citation_support_rate', type: 'float', nullable: true })
  citationSupportRate: number | null;

  @Column({ name: 'abstain_correctness', type: 'float', nullable: true })
  abstainCorrectness: number | null;

  @Column({ name: 'unsafe_overconfident_output_rate', type: 'float', nullable: true })
  unsafeOverconfidentOutputRate: number | null;

  @Column({ name: 'summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  summary: Record<string, any>;

  @Column({ name: 'gate_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  gateSummary: Record<string, any>;

  @Column({ name: 'executed_by', type: 'varchar', length: 120, nullable: true })
  executedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
