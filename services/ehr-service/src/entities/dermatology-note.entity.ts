import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dermatology_notes')
export class DermatologyNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'provider_id', type: 'uuid' }) providerId: string;
  @Column({ name: 'note_date', type: 'timestamptz' }) noteDate: Date;
  @Column({ name: 'presenting_complaint', type: 'text' }) presentingComplaint: string;
  @Column({ name: 'morphology_description', type: 'text', nullable: true }) morphologyDescription: string;
  @Column({ name: 'differential_diagnosis', type: 'jsonb', default: '[]' }) differentialDiagnosis: any;
  @Column({ name: 'ai_lesion_classification', type: 'jsonb', nullable: true }) aiLesionClassification: any;
  @Column({ type: 'text', nullable: true }) treatment: string;
  @Column({ name: 'follow_up_plan', type: 'text', nullable: true }) followUpPlan: string;
  @Column({ name: 'biopsy_requested', type: 'boolean', default: false }) biopsyRequested: boolean;
  @Column({ name: 'biopsy_site', type: 'text', nullable: true }) biopsySite: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
