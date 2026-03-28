import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('antibiogram_summaries')
export class AntibiogramSummary {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'period_label', type: 'text' }) periodLabel: string; // e.g. '2026-Q1'
  @Column({ name: 'specimen_type', type: 'text' }) specimenType: string;
  @Column({ type: 'jsonb' }) data: Record<string, any>; // organism → antibiotic → {S%, R%, I%, isolates}
  @Column({ name: 'top_resistant_organisms', type: 'jsonb', default: '[]' }) topResistantOrganisms: any[];
  @Column({ name: 'recommended_empirical_choices', type: 'jsonb', default: '{}' }) recommendedEmpiricalChoices: Record<string, any>;
  @Column({ name: 'generated_at', type: 'timestamptz' }) generatedAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
