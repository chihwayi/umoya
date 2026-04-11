import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mdsr_notifications')
export class MdsrNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'death_certificate_id', type: 'uuid', nullable: true })
  deathCertificateId: string | null;

  @Column({ name: 'death_date', type: 'date' })
  deathDate: string;

  @Column({ name: 'weeks_gestation_at_death', type: 'int', nullable: true })
  weeksGestationAtDeath: number | null;

  @Column({ name: 'primary_cause', nullable: true })
  primaryCause: string | null;

  @Column({ name: 'primary_cause_icd10', nullable: true })
  primaryCauseIcd10: string | null;

  @Column({ name: 'avoidable', type: 'boolean', nullable: true })
  avoidable: boolean | null;

  @Column({ name: 'avoidance_factors', type: 'text', nullable: true })
  avoidanceFactors: string | null;

  @Column({ name: 'committee_review_date', type: 'date', nullable: true })
  committeeReviewDate: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'action_points', type: 'text', nullable: true })
  actionPoints: string | null;

  @Column({ name: 'submitted_to_moh', default: false })
  submittedToMoh: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
