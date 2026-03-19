import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('regional_disease_reports')
export class RegionalDiseaseReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'report_period', type: 'text' }) reportPeriod: string; // e.g. '2026-W12' or '2026-03'
  @Column({ name: 'period_type', type: 'text' }) periodType: string; // weekly|monthly
  @Column({ name: 'facility_id', type: 'text', nullable: true }) facilityId: string;
  @Column({ name: 'malaria_cases', type: 'int', default: 0 }) malariaCases: number;
  @Column({ name: 'malaria_deaths', type: 'int', default: 0 }) malariaDeaths: number;
  @Column({ name: 'cholera_cases', type: 'int', default: 0 }) choleraCases: number;
  @Column({ name: 'cholera_deaths', type: 'int', default: 0 }) choleraDeaths: number;
  @Column({ name: 'typhoid_cases', type: 'int', default: 0 }) typhoidCases: number;
  @Column({ name: 'ntd_cases', type: 'int', default: 0 }) ntdCases: number;
  @Column({ name: 'schistosomiasis_cases', type: 'int', default: 0 }) schistosomiasisCases: number;
  @Column({ name: 'submitted_to_mohcc', type: 'boolean', default: false }) submittedToMohcc: boolean;
  @Column({ name: 'submission_date', type: 'date', nullable: true }) submissionDate: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
