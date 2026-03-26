import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('stroke_assessments')
export class StrokeAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'timestamptz', default: () => 'now()' })
  assessmentDate: Date;

  @Column({ name: 'stroke_type', type: 'text' })
  strokeType: string;

  @Column({ name: 'onset_time', type: 'timestamptz', nullable: true })
  onsetTime: Date | null;

  @Column({ name: 'last_known_well', type: 'timestamptz', nullable: true })
  lastKnownWell: Date | null;

  @Column({ name: 'nihss_score', type: 'int', nullable: true })
  nihssScore: number | null;

  @Column({ name: 'ct_findings', type: 'text', nullable: true })
  ctFindings: string | null;

  @Column({ name: 'mri_findings', type: 'text', nullable: true })
  mriFindings: string | null;

  @Column({ name: 'vessel_occlusion', type: 'text', nullable: true })
  vesselOcclusion: string | null;

  @Column({ name: 'ivtpa_eligible', type: 'boolean', nullable: true })
  ivtpaEligible: boolean | null;

  @Column({ name: 'ivtpa_administered', type: 'boolean', default: false })
  ivtpaAdministered: boolean;

  @Column({ name: 'ivtpa_time', type: 'timestamptz', nullable: true })
  ivtpaTime: Date | null;

  @Column({ name: 'thrombectomy_performed', type: 'boolean', default: false })
  thrombectomyPerformed: boolean;

  @Column({ name: 'thrombectomy_time', type: 'timestamptz', nullable: true })
  thrombectomyTime: Date | null;

  @Column({ name: 'mrs_score_admission', type: 'int', nullable: true })
  mrsScoreAdmission: number | null;

  @Column({ name: 'mrs_score_discharge', type: 'int', nullable: true })
  mrsScoreDischarge: number | null;

  @Column({ name: 'mrs_score_90day', type: 'int', nullable: true })
  mrsScore90day: number | null;

  @Column({ name: 'risk_factors', type: 'jsonb', default: [] })
  riskFactors: any[];

  @Column({ name: 'secondary_prevention', type: 'jsonb', default: [] })
  secondaryPrevention: any[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ name: 'aspects_score', type: 'int', nullable: true })
  aspectsScore?: number;

  @Column({ name: 'door_to_needle_minutes', type: 'int', nullable: true })
  doorToNeedleMinutes?: number;

  @Column({ name: 'mrs_discharge', type: 'int', nullable: true })
  mrsDischarge?: number;

  @Column({ nullable: true })
  outcome?: string;

  @Column({ name: 'thrombectomy_given', type: 'boolean', nullable: true, default: false })
  thrombectomyGiven: boolean = false;

  @Column({ name: 'thrombolysis_given', type: 'boolean', nullable: true, default: false })
  thrombolysisGiven: boolean = false;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
