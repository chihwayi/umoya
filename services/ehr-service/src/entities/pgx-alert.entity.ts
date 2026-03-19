import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pgx_alerts')
export class PgxAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ type: 'text' }) drug: string;
  @Column({ name: 'pgx_interaction', type: 'text' }) pgxInteraction: string;
  @Column({ name: 'clinical_implication', type: 'text' }) clinicalImplication: string;
  @Column({ name: 'alternative_recommended', type: 'text', nullable: true }) alternativeRecommended: string;
  @Column({ type: 'text' }) severity: string; // contraindicated|major|moderate|minor|informational
  @Column({ name: 'gene_involved', type: 'text', nullable: true }) geneInvolved: string;
  @Column({ name: 'acknowledged', type: 'boolean', default: false }) acknowledged: boolean;
  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true }) acknowledgedBy: string;
  @CreateDateColumn({ name: 'generated_at', type: 'timestamptz' }) generatedAt: Date;
}
