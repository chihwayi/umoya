import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('maternal_deaths')
export class MaternalDeath {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string | null;

  @Column({ name: 'reported_by', type: 'uuid' })
  reportedBy: string;

  @Column({ name: 'death_date', type: 'date' })
  deathDate: string;

  @Column({ name: 'age_at_death', type: 'int', nullable: true })
  ageAtDeath: number | null;

  @Column({ name: 'gestational_age_weeks', type: 'int', nullable: true })
  gestationalAgeWeeks: number | null;

  @Column({ name: 'death_category', type: 'text', default: 'undetermined' })
  deathCategory: string;

  @Column({ name: 'primary_cause', type: 'text', nullable: true })
  primaryCause: string | null;

  @Column({ name: 'icd10_primary', type: 'text', nullable: true })
  icd10Primary: string | null;

  @Column({ name: 'contributing_causes', type: 'jsonb', default: [] })
  contributingCauses: Array<Record<string, any> | string>;

  @Column({ name: 'delay_1_recognition', type: 'boolean', nullable: true })
  delay1Recognition: boolean | null;

  @Column({ name: 'delay_2_reaching', type: 'boolean', nullable: true })
  delay2Reaching: boolean | null;

  @Column({ name: 'delay_3_care', type: 'boolean', nullable: true })
  delay3Care: boolean | null;

  @Column({ name: 'delay_notes', type: 'text', nullable: true })
  delayNotes: string | null;

  @Column({ type: 'boolean', nullable: true })
  avoidable: boolean | null;

  @Column({ name: 'avoidability_factors', type: 'jsonb', default: [] })
  avoidabilityFactors: Array<Record<string, any> | string>;

  @Column({ name: 'referred_from', type: 'text', nullable: true })
  referredFrom: string | null;

  @Column({ name: 'mode_of_admission', type: 'text', nullable: true })
  modeOfAdmission: string | null;

  @Column({ name: 'is_near_miss', type: 'boolean', default: false })
  isNearMiss: boolean;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ name: 'notification_sent_at', type: 'timestamptz', nullable: true })
  notificationSentAt: Date | null;

  @Column({ name: 'review_status', type: 'text', default: 'pending' })
  reviewStatus: string;

  @Column({ name: 'district_submission_ref', type: 'text', nullable: true })
  districtSubmissionRef: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
