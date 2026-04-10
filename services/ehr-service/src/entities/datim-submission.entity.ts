import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('datim_submissions')
export class DatimSubmission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'period', length: 10 }) period: string;
  @Column({ name: 'org_unit_uid', length: 50 }) orgUnitUid: string;
  @Column({ name: 'indicator_count', type: 'int', nullable: true }) indicatorCount: number | null;
  @Column({ name: 'status', length: 20, default: 'pending' }) status: string;
  @Column({ name: 'datim_import_summary', type: 'jsonb', nullable: true }) datimImportSummary: Record<string, any> | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
