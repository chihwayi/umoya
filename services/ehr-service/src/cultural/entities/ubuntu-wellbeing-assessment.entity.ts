import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ubuntu_wellbeing_assessments')
export class UbuntuWellbeingAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy: string | null;

  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' })
  assessmentDate: string;

  @Column({ name: 'social_connectedness', type: 'text', default: 'moderate' })
  socialConnectedness: string;

  @Column({ name: 'community_belonging', type: 'text', nullable: true })
  communityBelonging: string | null;

  @Column({ name: 'spiritual_wellbeing', type: 'text', nullable: true })
  spiritualWellbeing: string | null;

  @Column({ name: 'ancestral_harmony', type: 'text', nullable: true })
  ancestralHarmony: string | null;

  @Column({ name: 'grief_bereavement', type: 'boolean', default: false })
  griefBereavement: boolean;

  @Column({ name: 'grief_type', type: 'text', nullable: true })
  griefType: string | null;

  @Column({ name: 'currently_using_traditional_healer', type: 'boolean', default: false })
  currentlyUsingTraditionalHealer: boolean;

  @Column({ name: 'traditional_healer_type', type: 'text', nullable: true })
  traditionalHealerType: string | null;

  @Column({ name: 'traditional_healer_treatment', type: 'text', nullable: true })
  traditionalHealerTreatment: string | null;

  @Column({ name: 'herb_drug_interaction_risk', type: 'text', nullable: true })
  herbDrugInteractionRisk: string | null;

  @Column({ name: 'phq9_score', type: 'int', nullable: true })
  phq9Score: number | null;

  @Column({ name: 'gad7_score', type: 'int', nullable: true })
  gad7Score: number | null;

  @Column({ name: 'stigma_experienced', type: 'boolean', nullable: true })
  stigmaExperienced: boolean | null;

  @Column({ name: 'help_seeking_barriers', type: 'jsonb', default: () => "'[]'" })
  helpSeekingBarriers: string[];

  @Column({ name: 'cdss_psychosocial_risk', type: 'text', nullable: true })
  cdssPsychosocialRisk: string | null;

  @Column({ name: 'cdss_recommendation', type: 'text', nullable: true })
  cdssRecommendation: string | null;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  cdssConfidence: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
