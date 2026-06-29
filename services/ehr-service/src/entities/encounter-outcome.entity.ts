import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type EncounterType =
  | 'hiv_visit' | 'delivery' | 'tb_case' | 'nutrition_admission'
  | 'icu_admission' | 'ncd_visit' | 'postop' | 'dialysis_session'
  | 'oncology_cycle' | 'nicu_admission' | 'mental_health_session' | 'oem_assessment';

export type OutcomeType =
  | 'alive_stable' | 'alive_controlled' | 'alive_uncontrolled'
  | 'alive_in_care' | 'ltfu' | 'deceased' | 'transferred_out'
  | 'cured' | 'defaulted' | 'treatment_failure' | 'not_evaluated' | 'readmitted';

@Entity('encounter_outcomes')
export class EncounterOutcome {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column('uuid') encounterId: string;
  @Column() encounterType: EncounterType;
  @Column('uuid') patientId: string;
  @Column() outcomeType: OutcomeType;
  @Column('date') outcomeDate: string;
  @Column('int') followUpWindowDays: number;
  @Column({ nullable: true }) clinicalNotes: string;
  @Column({ type: 'uuid', nullable: true }) verifiedBy: string;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date;
  @Column({ default: false }) autoFlagged: boolean;
  @Column({ default: 'manual' }) dataSource: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
