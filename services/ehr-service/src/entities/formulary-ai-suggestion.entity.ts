import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('formulary_ai_suggestions')
export class FormularyAiSuggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'prescription_id', type: 'uuid', nullable: true }) prescriptionId: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'branded_drug', type: 'text' }) brandedDrug: string;
  @Column({ name: 'generic_alternative', type: 'text', nullable: true }) genericAlternative: string;
  @Column({ name: 'branded_cost', type: 'numeric', nullable: true }) brandedCost: number;
  @Column({ name: 'generic_cost', type: 'numeric', nullable: true }) genericCost: number;
  @Column({ name: 'saving_amount', type: 'numeric', nullable: true }) savingAmount: number;
  @Column({ name: 'medical_aid_coverage', type: 'boolean', default: false }) medicalAidCoverage: boolean;
  @Column({ name: 'medical_aid_tier', type: 'int', nullable: true }) medicalAidTier: number;
  @Column({ name: 'evidence_equivalence', type: 'text', nullable: true }) evidenceEquivalence: string; // A|B|C
  @Column({ name: 'ai_recommendation', type: 'text' }) aiRecommendation: string; // generic|branded|no_substitute
  @Column({ type: 'text', nullable: true }) reason: string;
  @Column({ type: 'boolean', nullable: true }) accepted: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
