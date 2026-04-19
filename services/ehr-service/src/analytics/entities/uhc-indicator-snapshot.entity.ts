import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'uhc_indicator_snapshots' })
export class UhcIndicatorSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'period_year' })
  periodYear: number;

  @Column({ name: 'period_quarter', nullable: true })
  periodQuarter: number | null;

  @Column({ name: 'period_month', nullable: true })
  periodMonth: number | null;

  @Column({ name: 'facility_code', nullable: true })
  facilityCode: string | null;

  @Column({ name: 'facility_name', nullable: true })
  facilityName: string | null;

  @Column({ name: 'district', nullable: true })
  district: string | null;

  @Column({ name: 'anc1_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  anc1Coverage: number | null;

  @Column({ name: 'anc4_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  anc4Coverage: number | null;

  @Column({ name: 'skilled_birth_attendance', type: 'decimal', precision: 5, scale: 2, nullable: true })
  skilledBirthAttendance: number | null;

  @Column({ name: 'c_section_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cSectionRate: number | null;

  @Column({ name: 'maternal_mortality_ratio', type: 'decimal', precision: 8, scale: 2, nullable: true })
  maternalMortalityRatio: number | null;

  @Column({ name: 'neonatal_mortality_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  neonatalMortalityRate: number | null;

  @Column({ name: 'u5_mortality_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  u5MortalityRate: number | null;

  @Column({ name: 'dtp3_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dtp3Coverage: number | null;

  @Column({ name: 'measles_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  measlesCoverage: number | null;

  @Column({ name: 'fully_immunised_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  fullyImmunisedCoverage: number | null;

  @Column({ name: 'hiv_art_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  hivArtCoverage: number | null;

  @Column({ name: 'hiv_viral_suppression', type: 'decimal', precision: 5, scale: 2, nullable: true })
  hivViralSuppression: number | null;

  @Column({ name: 'tb_treatment_success_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  tbTreatmentSuccessRate: number | null;

  @Column({ name: 'tb_case_detection_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  tbCaseDetectionRate: number | null;

  @Column({ name: 'htn_treatment_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  htnTreatmentCoverage: number | null;

  @Column({ name: 'htn_controlled', type: 'decimal', precision: 5, scale: 2, nullable: true })
  htnControlled: number | null;

  @Column({ name: 'dm_treatment_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dmTreatmentCoverage: number | null;

  @Column({ name: 'modern_contraceptive_prevalence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  modernContraceptivePrevalence: number | null;

  @Column({ name: 'unmet_need_fp', type: 'decimal', precision: 5, scale: 2, nullable: true })
  unmetNeedFp: number | null;

  @Column({ name: 'uhc_sci_composite', type: 'decimal', precision: 5, scale: 2, nullable: true })
  uhcSciComposite: number | null;

  @Column({ name: 'out_of_pocket_catastrophic_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  outOfPocketCatastrophicPct: number | null;

  @Column({ name: 'cbhi_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cbhiCoverage: number | null;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;

  @Column({ name: 'computation_method', default: 'facility_query' })
  computationMethod: string;

  @Column({ name: 'cdss_gap_flags', type: 'jsonb', nullable: true })
  cdssGapFlags: string[] | null;

  @Column({ name: 'cdss_priority_actions', type: 'jsonb', nullable: true })
  cdssPriorityActions: string[] | null;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  cdssConfidence: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
