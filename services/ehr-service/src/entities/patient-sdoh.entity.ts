import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

/**
 * Social Determinants of Health assessment.
 * One patient can have multiple assessments over time.
 * The latest assessment per patient is used for AI risk stratification.
 *
 * Provisioned in Sprint 60 — provision-sprint60-patient-extended-sdoh.ts
 */
@Entity('patient_sdoh')
export class PatientSdoh {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' })
  assessmentDate: Date;

  // ── Housing ───────────────────────────────────────────────────────────────
  /** stable | unstable | homeless | at_risk */
  @Column({ name: 'housing_status', nullable: true, length: 30 })
  housingStatus?: string;

  // ── Food security ─────────────────────────────────────────────────────────
  /** secure | insecure | hungry */
  @Column({ name: 'food_security_status', nullable: true, length: 30 })
  foodSecurityStatus?: string;

  // ── Transportation ────────────────────────────────────────────────────────
  /** own | public | none | barrier */
  @Column({ name: 'transportation_access', nullable: true, length: 30 })
  transportationAccess?: string;

  // ── Social isolation ──────────────────────────────────────────────────────
  /** 0 = well-connected, 10 = severely isolated */
  @Column({ name: 'social_isolation_score', type: 'int', nullable: true })
  socialIsolationScore?: number;

  // ── Financial ─────────────────────────────────────────────────────────────
  /** none | mild | moderate | severe */
  @Column({ name: 'financial_strain', nullable: true, length: 30 })
  financialStrain?: string;

  // ── Education & literacy ──────────────────────────────────────────────────
  /** adequate | limited | inadequate */
  @Column({ name: 'literacy_level', nullable: true, length: 30 })
  literacyLevel?: string;

  // ── ICD-11 Z-codes applicable ─────────────────────────────────────────────
  /** Array of { code, description } objects */
  @Column({ name: 'icd_z_codes', type: 'jsonb', default: [] })
  icdZCodes: Array<{ code: string; description: string }> = [];

  // ── Community referrals ───────────────────────────────────────────────────
  /** Array of { resource, referralDate, status } objects */
  @Column({ name: 'community_resource_referrals', type: 'jsonb', default: [] })
  communityResourceReferrals: Array<{ resource: string; referralDate?: string; status?: string }> = [];

  // ── Metadata ──────────────────────────────────────────────────────────────
  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy?: string;

  @Column({ name: 'next_assessment_due', type: 'date', nullable: true })
  nextAssessmentDue?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
