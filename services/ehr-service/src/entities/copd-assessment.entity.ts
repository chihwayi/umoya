import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('copd_assessments')
export class CopdAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ name: 'cat_score', type: 'smallint', nullable: true }) catScore: number;
  @Column({ name: 'mmrc_dyspnea', type: 'smallint', nullable: true }) mmrcDyspnea: number;
  @Column({ name: 'abcd_group', type: 'text', nullable: true }) abcdGroup: string;
  @Column({ name: 'exacerbation_history', type: 'jsonb', default: '[]' }) exacerbationHistory: any;
  @Column({ name: 'exacerbations_last_year', type: 'smallint', default: 0 }) exacerbationsLastYear: number;
  @Column({ name: 'hospitalizations_last_year', type: 'smallint', default: 0 }) hospitalizationsLastYear: number;
  @Column({ name: 'current_inhaler_therapy', type: 'jsonb', default: '[]' }) currentInhalerTherapy: any;
  @Column({ name: 'smoking_pack_years', type: 'numeric', precision: 5, scale: 1, nullable: true }) smokingPackYears: number;
  @Column({ name: 'smoking_status', type: 'text', nullable: true }) smokingStatus: string;
  @Column({ name: 'oxygen_at_home', type: 'boolean', default: false }) oxygenAtHome: boolean;
  @Column({ name: 'pulmonary_rehab_completed', type: 'boolean', default: false }) pulmonaryRehabCompleted: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'current_medications', type: 'jsonb', nullable: true, default: [] })
  currentMedications: any = [];

  @Column({ name: 'gold_group', type: 'text', nullable: true })
  goldGroup?: string;

  @Column({ name: 'mmrc_dyspnoea', type: 'int', nullable: true })
  mmrcDyspnoea?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
