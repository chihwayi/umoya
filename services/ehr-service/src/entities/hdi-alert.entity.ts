import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('hdi_alerts')
export class HdiAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'tm_remedy_id', type: 'uuid', nullable: true }) tmRemedyId: string | null;
  @Column({ name: 'drug_name', length: 200 }) drugName: string;
  @Column({ name: 'drug_rxcui', length: 30, nullable: true }) drugRxcui: string | null;
  @Column({ name: 'interaction_type', length: 30 }) interactionType: string;
  @Column({ length: 100, nullable: true }) mechanism: string | null;
  @Column({ length: 15 }) severity: string;
  @Column({ name: 'clinical_effect', type: 'text' }) clinicalEffect: string;
  @Column({ type: 'text', nullable: true }) management: string | null;
  @Column({ name: 'evidence_level', length: 10, nullable: true }) evidenceLevel: string | null;
  @Column({ name: 'triggered_at', type: 'timestamptz', default: () => 'NOW()' }) triggeredAt: Date;
  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true }) acknowledgedBy: string | null;
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true }) acknowledgedAt: Date | null;
  @Column({ name: 'override_reason', type: 'text', nullable: true }) overrideReason: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
