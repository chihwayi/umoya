import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cholera_cases')
export class CholeraCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'case_classification', type: 'text', default: 'suspected' }) caseClassification: string; // suspected|probable|confirmed
  @Column({ type: 'date' }) onset: string;
  @Column({ name: 'dehydration_severity', type: 'text', nullable: true }) dehydrationSeverity: string; // none|some|severe
  @Column({ name: 'ivf_given', type: 'boolean', default: false }) ivfGiven: boolean;
  @Column({ name: 'oral_rehydration', type: 'boolean', default: false }) oralRehydration: boolean;
  @Column({ type: 'text', nullable: true }) antibiotic: string;
  @Column({ name: 'contact_tracing', type: 'jsonb', default: '[]' }) contactTracing: any[];
  @Column({ name: 'outbreak_cluster', type: 'text', nullable: true }) outbreakCluster: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
