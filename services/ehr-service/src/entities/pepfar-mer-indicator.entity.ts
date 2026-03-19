import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pepfar_mer_indicators')
export class PepfarMerIndicator {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'reporting_period', type: 'text' }) reportingPeriod: string; // e.g. '2026Q1'
  @Column({ type: 'text' }) indicator: string; // TX_CURR|TX_NEW|TX_PVLS|HTS_TST|HTS_TST_POS|PMTCT_STAT|PMTCT_ART|TB_ART|TB_PREV
  @Column({ type: 'int', nullable: true }) numerator: number;
  @Column({ type: 'int', nullable: true }) denominator: number;
  @Column({ type: 'jsonb', default: '{}' }) disaggregations: Record<string, any>;
  @Column({ name: 'submitted_to_datim', type: 'boolean', default: false }) submittedToDataIM: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
