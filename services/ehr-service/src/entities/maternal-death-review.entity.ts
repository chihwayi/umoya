import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('maternal_death_reviews')
export class MaternalDeathReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'maternal_death_id', type: 'uuid' })
  maternalDeathId: string;

  @Column({ name: 'reviewed_by', type: 'uuid' })
  reviewedBy: string;

  @Column({ name: 'review_date', type: 'date' })
  reviewDate: string;

  @Column({ name: 'review_team', type: 'jsonb', default: [] })
  reviewTeam: Array<Record<string, any>>;

  @Column({ name: 'timeline_summary', type: 'text', nullable: true })
  timelineSummary: string | null;

  @Column({ name: 'standard_of_care', type: 'text', nullable: true })
  standardOfCare: string | null;

  @Column({ type: 'jsonb', default: [] })
  recommendations: Array<Record<string, any>>;

  @Column({ name: 'action_plan_agreed', type: 'boolean', default: false })
  actionPlanAgreed: boolean;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;

  @Column({ name: 'review_complete', type: 'boolean', default: false })
  reviewComplete: boolean;

  @Column({ name: 'submitted_to_district', type: 'boolean', default: false })
  submittedToDistrict: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
