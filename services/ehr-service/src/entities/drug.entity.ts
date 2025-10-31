import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DrugInteraction } from './drug-interaction.entity';

@Entity('drugs')
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'generic_name' })
  genericName: string;

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

  @OneToMany(() => DrugInteraction, interaction => interaction.drug1)
  interactionsAsDrug1: DrugInteraction[];

  @OneToMany(() => DrugInteraction, interaction => interaction.drug2)
  interactionsAsDrug2: DrugInteraction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

