import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('moh_alerts')
export class MohAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notifiable_disease_id', type: 'uuid', nullable: true })
  notifiableDiseaseId: string | null;

  @Column({ name: 'alert_type', length: 50 })
  alertType: string; // threshold | single_case | ihr_event

  @Column({ name: 'case_count', type: 'int', nullable: true })
  caseCount: number | null;

  @Column({ name: 'window_start', type: 'date', nullable: true })
  windowStart: string | null;

  @Column({ name: 'window_end', type: 'date', nullable: true })
  windowEnd: string | null;

  @Column({ name: 'alert_sent_at', type: 'timestamptz', nullable: true })
  alertSentAt: Date | null;

  @Column({ name: 'recipient_email', type: 'text', nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'ihr_event_id', length: 50, nullable: true })
  ihrEventId: string | null;

  @Column({ name: 'acknowledged', default: false })
  acknowledged: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
