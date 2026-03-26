import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('intake_assessments')
export class IntakeAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string | null;

  @Column({ name: 'assessment_type', type: 'varchar', length: 40, default: 'registration' })
  assessmentType: string;

  @Column({ name: 'completeness_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  completenessScore: number;

  @Column({ name: 'missing_fields', type: 'jsonb', default: () => "'[]'::jsonb" })
  missingFields: string[];

  @Column({ name: 'suspected_duplicate_count', type: 'int', default: 0 })
  suspectedDuplicateCount: number;

  @Column({ name: 'duplicate_candidates', type: 'jsonb', default: () => "'[]'::jsonb" })
  duplicateCandidates: Record<string, any>[];

  @Column({ name: 'coverage_risk_level', type: 'varchar', length: 20, default: 'low' })
  coverageRiskLevel: string;

  @Column({ name: 'coverage_flags', type: 'jsonb', default: () => "'[]'::jsonb" })
  coverageFlags: string[];

  @Column({ name: 'consent_ready', type: 'boolean', default: false })
  consentReady: boolean;

  @Column({ name: 'consent_missing_items', type: 'jsonb', default: () => "'[]'::jsonb" })
  consentMissingItems: string[];

  @Column({ name: 'front_desk_summary', type: 'text', nullable: true })
  frontDeskSummary?: string | null;

  @Column({ name: 'nurse_summary', type: 'text', nullable: true })
  nurseSummary?: string | null;

  @Column({ name: 'clinician_summary', type: 'text', nullable: true })
  clinicianSummary?: string | null;

  @Column({ name: 'document_extract_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  documentExtractIds: string[];

  @Column({ name: 'structured_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  structuredPayload: Record<string, any>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
