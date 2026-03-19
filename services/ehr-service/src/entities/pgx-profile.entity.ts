import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pgx_profiles')
export class PgxProfile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid', unique: true }) patientId: string;
  @Column({ name: 'genotype_source', type: 'text', default: 'lab_test' }) genotypeSource: string; // lab_test|patient_reported|inferred
  @Column({ name: 'report_date', type: 'date', nullable: true }) reportDate: string;
  // CYP enzymes
  @Column({ name: 'cyp2d6_phenotype', type: 'text', nullable: true }) cyp2d6Phenotype: string; // poor|intermediate|normal|ultrarapid
  @Column({ name: 'cyp2c19_phenotype', type: 'text', nullable: true }) cyp2c19Phenotype: string;
  @Column({ name: 'cyp2c9_phenotype', type: 'text', nullable: true }) cyp2c9Phenotype: string;
  @Column({ name: 'vkorc1_variant', type: 'text', nullable: true }) vkorc1Variant: string; // *1/*1|*1/*2|*2/*2 (warfarin sensitivity)
  @Column({ name: 'tpmt_phenotype', type: 'text', nullable: true }) tpmtPhenotype: string; // normal|intermediate|poor (thiopurine risk)
  // HLA alleles
  @Column({ name: 'hla_b_5701', type: 'text', nullable: true }) hlaB5701: string; // positive|negative (abacavir hypersensitivity)
  @Column({ name: 'hla_b_1502', type: 'text', nullable: true }) hlaB1502: string; // positive|negative (carbamazepine SJS)
  // Other
  @Column({ name: 'slco1b1_variant', type: 'text', nullable: true }) slco1b1Variant: string; // normal|reduced|poor (statin myopathy)
  @Column({ name: 'g6pd_status', type: 'text', nullable: true }) g6pdStatus: string; // normal|deficient|severe_deficiency
  @Column({ name: 'ugt1a1_phenotype', type: 'text', nullable: true }) ugt1a1Phenotype: string; // normal|poor (irinotecan toxicity)
  @Column({ name: 'raw_genotyping_data', type: 'jsonb', nullable: true }) rawGenotypingData: Record<string, any>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
