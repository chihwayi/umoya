import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('mohcc_report_submissions')
export class MohccReportSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_type' }) // HIMIS_MONTHLY | PEPFAR_MER | OPENMRS_SYNC
  reportType: string;

  @Column({ name: 'period_label' }) // e.g. 2026-02
  periodLabel: string;

  @Column({ name: 'facility_code', nullable: true })
  facilityCode: string;

  @Column({ name: 'payload', type: 'jsonb', default: '{}' })
  payload: Record<string, any>;

  @Column({ default: 'pending' }) // pending | submitted | accepted | rejected
  status: string;

  @Column({ name: 'response_code', nullable: true })
  responseCode: string;

  @Column({ name: 'response_message', nullable: true })
  responseMessage: string;

  @Column({ name: 'submitted_by', nullable: true })
  submittedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date;
}
