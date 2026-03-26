import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pharmacy_substitution_recommendations')
@Index('idx_pharmacy_sub_recommendations_review', ['reviewId', 'createdAt'])
@Index('idx_pharmacy_sub_recommendations_patient_status', ['patientId', 'recommendationStatus'])
export class PharmacySubstitutionRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'review_id', type: 'uuid', nullable: true })
  reviewId: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId: string | null;

  @Column({ name: 'source_medication_name', type: 'varchar', length: 255 })
  sourceMedicationName: string;

  @Column({ name: 'source_generic_name', type: 'varchar', length: 255, nullable: true })
  sourceGenericName: string | null;

  @Column({ name: 'generic_alternative', type: 'varchar', length: 255, nullable: true })
  genericAlternative: string | null;

  @Column({ name: 'recommendation_status', type: 'varchar', length: 30, default: 'recommended' })
  recommendationStatus: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 40, default: 'formulary_substitution' })
  recommendationType: string;

  @Column({ name: 'cost_impact', type: 'jsonb', default: () => "'{}'::jsonb" })
  costImpact: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
