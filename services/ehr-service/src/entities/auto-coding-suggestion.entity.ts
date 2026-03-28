import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('auto_coding_suggestions')
export class AutoCodingSuggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'note_id', type: 'uuid' }) noteId: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string;
  @Column({ name: 'suggested_icd10_codes', type: 'jsonb', default: '[]' }) suggestedIcd10Codes: any[]; // {code, description, confidence, evidence_span}
  @Column({ name: 'suggested_cpt_codes', type: 'jsonb', default: '[]' }) suggestedCptCodes: any[];
  @Column({ name: 'review_status', type: 'text', default: 'pending' }) reviewStatus: string; // pending|confirmed|modified|rejected
  @Column({ name: 'confirmed_codes', type: 'jsonb', nullable: true }) confirmedCodes: any;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy: string;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date;
  @Column({ name: 'coding_model', type: 'text', nullable: true }) codingModel: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
