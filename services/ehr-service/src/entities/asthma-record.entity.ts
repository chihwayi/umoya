import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('asthma_records')
export class AsthmaRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ name: 'act_score', type: 'smallint', nullable: true }) actScore: number;
  @Column({ name: 'acq_score', type: 'numeric', precision: 3, scale: 1, nullable: true }) acqScore: number;
  @Column({ type: 'text' }) severity: string;
  @Column({ type: 'text' }) control: string;
  @Column({ name: 'gina_step', type: 'smallint', nullable: true }) ginaStep: number;
  @Column({ name: 'trigger_factors', type: 'jsonb', default: '[]' }) triggerFactors: any;
  @Column({ name: 'asthma_action_plan', type: 'jsonb', default: '{}' }) asthmaActionPlan: any;
  @Column({ name: 'reliever_puffs_per_week', type: 'smallint', nullable: true }) relieverPuffsPerWeek: number;
  @Column({ name: 'nocturnal_symptoms', type: 'boolean', default: false }) nocturnalSymptoms: boolean;
  @Column({ name: 'oral_steroid_courses_last_year', type: 'smallint', default: 0 }) oralSteroidCoursesLastYear: number;
  @Column({ name: 'ige_total', type: 'numeric', precision: 7, scale: 1, nullable: true }) igeTotal: number;
  @Column({ name: 'eosinophil_count', type: 'numeric', precision: 6, scale: 3, nullable: true }) eosinophilCount: number;
  @Column({ name: 'biologics_eligible', type: 'boolean', default: false }) biologicsEligible: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'ace_score', type: 'int', nullable: true })
  aceScore?: number;

  @Column({ name: 'activity_limitation', type: 'boolean', nullable: true, default: false })
  activityLimitation: boolean = false;

  @Column({ name: 'current_ics_dose', type: 'text', nullable: true })
  currentIcsDose?: string;

  @Column({ name: 'gina_control', type: 'text', nullable: true })
  ginaControl?: string;

  @Column({ name: 'night_waking', type: 'boolean', nullable: true, default: false })
  nightWaking: boolean = false;

  @Column({ name: 'reliever_use_week', type: 'int', nullable: true })
  relieverUseWeek?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
