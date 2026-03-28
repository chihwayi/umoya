import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('geriatric_assessments')
export class GeriatricAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'timestamptz', default: () => 'now()' })
  assessmentDate: Date;

  @Column({ name: 'clinical_frailty_scale', type: 'int', nullable: true })
  clinicalFrailtyScale: number | null;

  @Column({ name: 'barthel_index', type: 'int', nullable: true })
  barthelIndex: number | null;

  @Column({ name: 'adl_score', type: 'int', nullable: true })
  adlScore: number | null;

  @Column({ name: 'iadl_score', type: 'int', nullable: true })
  iadlScore: number | null;

  @Column({ name: 'tinnetti_score', type: 'int', nullable: true })
  tinnettiScore: number | null;

  @Column({ name: 'mmse_score', type: 'int', nullable: true })
  mmseScore: number | null;

  @Column({ name: 'moca_score', type: 'int', nullable: true })
  mocaScore: number | null;

  @Column({ name: 'gds_score', type: 'int', nullable: true })
  gdsScore: number | null;

  @Column({ name: 'nutritional_screen', type: 'text', nullable: true })
  nutritionalScreen: string | null;

  @Column({ name: 'hearing_impaired', type: 'boolean', default: false })
  hearingImpaired: boolean;

  @Column({ name: 'vision_impaired', type: 'boolean', default: false })
  visionImpaired: boolean;

  @Column({ name: 'continence_issues', type: 'boolean', default: false })
  continenceIssues: boolean;

  @Column({ name: 'social_support', type: 'text', nullable: true })
  socialSupport: string | null;

  @Column({ name: 'caregiver_burden', type: 'text', nullable: true })
  caregiverBurden: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ name: 'cga_domains', type: 'jsonb', default: {} })
  cgaDomains: any = {};

  @Column({ name: 'falls_last_year', type: 'int', nullable: true, default: 0 })
  fallsLastYear: number = 0;

  @Column({ name: 'functional_status', type: 'text', nullable: true })
  functionalStatus?: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  polypharmacy: boolean = false;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
