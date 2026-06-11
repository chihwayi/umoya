import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DrugInteraction } from './drug-interaction.entity';

@Entity('drugs')
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'generic_name' })
  genericName: string;

  // MCAZ (Medicines Control Authority of Zimbabwe) schedule classification for
  // the catalog entry (e.g. 'Schedule I' … 'Schedule VIII' / dangerous drug).
  @Column({ name: 'mcaz_schedule', nullable: true })
  mcazSchedule: string;

  @Column({ type: 'text', array: true, nullable: true, name: 'brand_names' })
  brandNames: string[];

  @Column({ name: 'atc_code', nullable: true })
  atcCode: string;

  @Column({ name: 'drug_class', nullable: true })
  drugClass: string;

  @Column({ type: 'text', array: true, nullable: true, name: 'active_ingredients' })
  activeIngredients: string[];

  @Column({ type: 'text', array: true, nullable: true, name: 'dosage_forms' })
  dosageForms: string[];

  @Column({ type: 'text', array: true, nullable: true, name: 'route_of_administration' })
  routeOfAdministration: string[];

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // RxNorm fields
  @Column({ name: 'rxnorm_code', nullable: true, length: 20 })
  rxnormCode?: string;

  @Column({ name: 'rxnorm_name', type: 'text', nullable: true })
  rxnormName?: string;

  @Column({ name: 'rxnorm_tty', nullable: true, length: 10 })
  rxnormTty?: string; // Term Type: SCD, SCDC, etc.

  // SNOMED CT fields
  @Column({ name: 'snomed_code', nullable: true, length: 50 })
  snomedCode?: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm?: string;

  // NDC (National Drug Code)
  @Column({ name: 'ndc_code', nullable: true, length: 20 })
  ndcCode?: string;

  // Strength and unit
  @Column({ nullable: true, length: 50 })
  strength?: string;

  @Column({ nullable: true, length: 20 })
  unit?: string;

  // FHIR status
  @Column({ nullable: true, length: 20, default: 'active' })
  status?: string; // active, inactive, entered-in-error

  @OneToMany(() => DrugInteraction, interaction => interaction.drug1)
  interactionsAsDrug1: DrugInteraction[];

  @OneToMany(() => DrugInteraction, interaction => interaction.drug2)
  interactionsAsDrug2: DrugInteraction[];
  @Column({ name: 'average_unit_cost_usd', type: 'numeric', precision: 10, scale: 4, nullable: true })
  averageUnitCostUsd?: number;

  @Column({ name: 'bioequivalent_group', type: 'varchar', length: 100, nullable: true })
  bioequivalentGroup?: string;

  @Column({ name: 'formulary_tier', type: 'int', nullable: true })
  formularyTier?: number;

  @Column({ name: 'generic_name_canonical', type: 'varchar', length: 255, nullable: true })
  genericNameCanonical?: string;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

