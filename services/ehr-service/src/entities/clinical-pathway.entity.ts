import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('clinical_pathways')
export class ClinicalPathway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pathway_code', length: 100, unique: true })
  pathwayCode: string;

  @Column({ name: 'pathway_name', length: 255 })
  pathwayName: string;

  @Column({ name: 'pathway_version', length: 20 })
  pathwayVersion: string;

  @Column({ length: 255 })
  condition: string;

  @Column({ name: 'condition_codes', type: 'jsonb', default: '[]' })
  conditionCodes: string[];

  @Column({ name: 'condition_snomed_codes', type: 'jsonb', default: '[]' })
  conditionSnomedCodes: any[];

  @Column({ name: 'target_diagnoses_icd10', type: 'jsonb', default: '[]' })
  targetDiagnosesIcd10: any[];

  @Column({ length: 100, nullable: true })
  specialty: string;

  @Column({ name: 'evidence_level', length: 20, nullable: true })
  evidenceLevel: string;

  @Column({ name: 'guideline_source', length: 255, nullable: true })
  guidelineSource: string;

  @Column({ name: 'guideline_url', type: 'text', nullable: true })
  guidelineUrl: string;

  @Column({ name: 'pathway_type', length: 50, nullable: true })
  pathwayType: string;

  @Column({ name: 'target_population', type: 'text', nullable: true })
  targetPopulation: string;

  @Column({ name: 'inclusion_criteria', type: 'text', nullable: true })
  inclusionCriteria: string;

  @Column({ name: 'inclusion_criteria_snomed', type: 'jsonb', default: '[]' })
  inclusionCriteriaSnomed: any[];

  @Column({ name: 'exclusion_criteria', type: 'text', nullable: true })
  exclusionCriteria: string;

  @Column({ name: 'exclusion_criteria_snomed', type: 'jsonb', default: '[]' })
  exclusionCriteriaSnomed: any[];

  @Column({ name: 'pathway_duration_days', nullable: true })
  pathwayDurationDays: number;

  @Column({ name: 'expected_outcomes', type: 'text', nullable: true })
  expectedOutcomes: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  objectives: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date;

  @Column({ name: 'last_reviewed_by', type: 'uuid', nullable: true })
  lastReviewedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_reviewed_by' })
  lastReviewedByUser: User;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

