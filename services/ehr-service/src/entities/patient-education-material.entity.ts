import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('patient_education_materials')
export class PatientEducationMaterial {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string;
  @Column({ type: 'text' }) topic: string;
  @Column({ type: 'text' }) language: string; // en|sn|nd|pt
  @Column({ name: 'reading_level', type: 'int', default: 6 }) readingLevel: number; // grade 4|6|8
  @Column({ type: 'text', nullable: true }) content: string;
  @Column({ name: 'content_html', type: 'text', nullable: true }) contentHtml: string;
  @Column({ name: 'pdf_storage_key', type: 'text', nullable: true }) pdfStorageKey: string;
  @Column({ name: 'delivery_method', type: 'text', default: 'portal' }) deliveryMethod: string; // portal|sms|printed
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true }) deliveredAt: Date;
  @Column({ name: 'ai_generated', type: 'boolean', default: true }) aiGenerated: boolean;
  @Column({ name: 'template_id', type: 'uuid', nullable: true }) templateId: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
