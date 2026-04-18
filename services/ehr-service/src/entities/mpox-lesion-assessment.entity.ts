import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VhfCase } from './vhf-case.entity';

@Entity('mpox_lesion_assessments')
export class MpoxLesionAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'vhf_case_id', type: 'uuid', nullable: true })
  vhfCaseId: string | null;

  @ManyToOne(() => VhfCase, (vhfCase) => vhfCase.lesionAssessments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vhf_case_id' })
  vhfCase?: VhfCase | null;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ type: 'text' })
  stage: string;

  @Column({ name: 'day_of_illness', type: 'int', nullable: true })
  dayOfIllness: number | null;

  @Column({ name: 'lesion_count_estimate', type: 'int', nullable: true })
  lesionCountEstimate: number | null;

  @Column({ name: 'lesion_count_category', type: 'text', nullable: true })
  lesionCountCategory: string | null;

  @Column({ name: 'lesion_distribution', type: 'jsonb', default: {} })
  lesionDistribution: Record<string, any>;

  @Column({ name: 'lesion_depth', type: 'text', nullable: true })
  lesionDepth: string | null;

  @Column({ name: 'lesion_synchrony', type: 'text', nullable: true })
  lesionSynchrony: string | null;

  @Column({ name: 'secondary_bacterial_infection', default: false })
  secondaryBacterialInfection: boolean;

  @Column({ name: 'corneal_involvement', default: false })
  cornealInvolvement: boolean;

  @Column({ name: 'respiratory_involvement', default: false })
  respiratoryInvolvement: boolean;

  @Column({ default: false })
  encephalitis: boolean;

  @Column({ name: 'genital_lesions', default: false })
  genitalLesions: boolean;

  @Column({ default: false })
  proctitis: boolean;

  @Column({ name: 'complications_notes', type: 'text', nullable: true })
  complicationsNotes: string | null;

  @Column({ name: 'cns_involvement', default: false })
  cnsInvolvement: boolean;

  @Column({ name: 'cns_symptoms', type: 'jsonb', default: [] })
  cnsSymptoms: string[];

  @Column({ name: 'antiviral_indicated', default: false })
  antiviralIndicated: boolean;

  @Column({ name: 'antiviral_drug', type: 'text', nullable: true })
  antiviralDrug: string | null;

  @Column({ name: 'antiviral_start_date', type: 'date', nullable: true })
  antiviralStartDate: string | null;

  @Column({ name: 'antiviral_dose', type: 'text', nullable: true })
  antiviralDose: string | null;

  @Column({ name: 'supportive_care', type: 'jsonb', default: [] })
  supportiveCare: string[];

  @Column({ name: 'cdss_severity_score', type: 'decimal', precision: 3, scale: 1, nullable: true })
  cdssSeverityScore: number | null;

  @Column({ name: 'cdss_recommendation', type: 'text', nullable: true })
  cdssRecommendation: string | null;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  cdssConfidence: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
