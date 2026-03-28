import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('radiology_ai_findings')
export class RadiologyAiFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'study_id' })
  studyId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'modality' }) // CXR | FUNDUS | DERM
  modality: string;

  @Column({ name: 'findings', type: 'jsonb', default: '[]' })
  // [{ label, confidence, severity, region, icd10 }]
  findings: Array<{ label: string; confidence: number; severity: string; region?: string; icd10?: string }>;

  @Column({ name: 'top_finding', nullable: true })
  topFinding: string;

  @Column({ name: 'overall_confidence', type: 'float', nullable: true })
  overallConfidence: number;

  @Column({ name: 'heatmap_storage_key', nullable: true })
  heatmapStorageKey: string;

  @Column({ name: 'model_version', nullable: true })
  modelVersion: string;

  @Column({ name: 'radiologist_reviewed', default: false })
  radiologistReviewed: boolean;

  @Column({ name: 'radiologist_notes', nullable: true })
  radiologistNotes: string;

  @Column({ name: 'alerted', default: false })
  alerted: boolean;

  @CreateDateColumn({ name: 'analyzed_at' })
  analyzedAt: Date;
}
