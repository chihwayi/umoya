import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('skin_lesions')
export class SkinLesion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'body_location', type: 'jsonb', default: '{}' }) bodyLocation: any;
  @Column({ name: 'lesion_type', type: 'text', nullable: true }) lesionType: string;
  @Column({ type: 'jsonb', default: '{}' }) dimensions: any;
  @Column({ type: 'text', nullable: true }) morphology: string;
  @Column({ type: 'text', nullable: true }) colour: string;
  @Column({ type: 'text', nullable: true }) borders: string;
  @Column({ type: 'text', nullable: true }) surface: string;
  @Column({ type: 'jsonb', default: '{}' }) evolution: any;
  @Column({ name: 'photograph_key', type: 'text', nullable: true }) photographKey: string;
  @Column({ name: 'dermoscopy_key', type: 'text', nullable: true }) dermoscopyKey: string;
  @Column({ name: 'ai_classification', type: 'jsonb', nullable: true }) aiClassification: any;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'biopsy_result', type: 'text', nullable: true })
  biopsyResult?: string;

  @Column({ name: 'dermoscopy_findings', type: 'text', nullable: true })
  dermoscopyFindings?: string;

  @Column({ nullable: true })
  diagnosis?: string;

  @Column({ name: 'diameter_mm', type: 'numeric', precision: 5, scale: 1, nullable: true })
  diameterMm?: number;

  @Column({ name: 'documentation_date', type: 'date' })
  documentationDate: Date;

  @Column({ name: 'documented_by', type: 'uuid' })
  documentedBy: string;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  images: any = [];

  @Column({ nullable: true })
  location?: string;

  @Column({ name: 'management_plan', type: 'text', nullable: true })
  managementPlan?: string;

  @Column({ name: 'size_mm', type: 'numeric', precision: 5, scale: 1, nullable: true })
  sizeMm?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
