import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('diabetic_foot_assessments')
export class DiabeticFootAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ name: 'right_foot_sensation', type: 'text', nullable: true })
  rightFootSensation: string | null;

  @Column({ name: 'left_foot_sensation', type: 'text', nullable: true })
  leftFootSensation: string | null;

  @Column({ name: 'right_foot_pulses', type: 'text', nullable: true })
  rightFootPulses: string | null;

  @Column({ name: 'left_foot_pulses', type: 'text', nullable: true })
  leftFootPulses: string | null;

  @Column({ name: 'right_foot_deformity', type: 'boolean', default: false })
  rightFootDeformity: boolean;

  @Column({ name: 'left_foot_deformity', type: 'boolean', default: false })
  leftFootDeformity: boolean;

  @Column({ name: 'deformity_description', type: 'text', nullable: true })
  deformityDescription: string | null;

  @Column({ name: 'callus_present', type: 'boolean', default: false })
  callusPresent: boolean;

  @Column({ name: 'right_wagner_grade', type: 'int', nullable: true })
  rightWagnerGrade: number | null;

  @Column({ name: 'left_wagner_grade', type: 'int', nullable: true })
  leftWagnerGrade: number | null;

  @Column({ name: 'ulcer_present', type: 'boolean', default: false })
  ulcerPresent: boolean;

  @Column({ name: 'ulcer_location', type: 'text', nullable: true })
  ulcerLocation: string | null;

  @Column({ name: 'ulcer_size_cm2', type: 'decimal', precision: 6, scale: 2, nullable: true })
  ulcerSizeCm2: number | null;

  @Column({ name: 'ulcer_depth', type: 'text', nullable: true })
  ulcerDepth: string | null;

  @Column({ name: 'wound_bed', type: 'text', nullable: true })
  woundBed: string | null;

  @Column({ name: 'infection_signs', type: 'jsonb', default: [] })
  infectionSigns: string[];

  @Column({ name: 'right_abi', type: 'decimal', precision: 4, scale: 2, nullable: true })
  rightAbi: number | null;

  @Column({ name: 'left_abi', type: 'decimal', precision: 4, scale: 2, nullable: true })
  leftAbi: number | null;

  @Column({ name: 'referred_to_podiatry', type: 'boolean', default: false })
  referredToPodiatry: boolean;

  @Column({ name: 'referred_to_surgery', type: 'boolean', default: false })
  referredToSurgery: boolean;

  @Column({ name: 'dressing_type', type: 'text', nullable: true })
  dressingType: string | null;

  @Column({ name: 'offloading_device', type: 'text', nullable: true })
  offloadingDevice: string | null;

  @Column({ name: 'antibiotic_prescribed', type: 'text', nullable: true })
  antibioticPrescribed: string | null;

  @Column({ name: 'review_in_days', type: 'int', nullable: true })
  reviewInDays: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
