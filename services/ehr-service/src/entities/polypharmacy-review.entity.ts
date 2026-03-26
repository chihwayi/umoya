import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('polypharmacy_reviews')
export class PolypharmacyReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'reviewed_by', type: 'uuid' })
  reviewedBy: string;

  @Column({ name: 'review_date', type: 'timestamptz', default: () => 'now()' })
  reviewDate: Date;

  @Column({ name: 'total_medications', type: 'int', default: 0 })
  totalMedications: number;

  @Column({ name: 'beers_criteria_flags', type: 'jsonb', default: [] })
  beersCriteriaFlags: any[];

  @Column({ name: 'stopp_start_flags', type: 'jsonb', default: [] })
  stoppStartFlags: any[];

  @Column({ name: 'deprescribing_recommendations', type: 'jsonb', default: [] })
  deprescribingRecommendations: any[];

  @Column({ name: 'medications_reviewed', type: 'jsonb', default: [] })
  medicationsReviewed: any[];

  @Column({ name: 'action_taken', type: 'text', nullable: true })
  actionTaken: string | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;
  @Column({ name: 'drug_interactions', type: 'jsonb', nullable: true, default: [] })
  drugInteractions: any = [];

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'potentially_inappropriate', type: 'jsonb', nullable: true, default: [] })
  potentiallyInappropriate: any = [];


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
