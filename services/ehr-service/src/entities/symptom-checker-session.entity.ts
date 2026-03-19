import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('symptom_checker_sessions')
export class SymptomCheckerSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'reported_symptoms', type: 'jsonb', default: '[]' })
  reportedSymptoms: string[];

  @Column({ name: 'duration_days', nullable: true })
  durationDays: number;

  @Column({ name: 'severity', nullable: true }) // mild | moderate | severe
  severity: string;

  @Column({ name: 'differential', type: 'jsonb', default: '[]' })
  // [{ condition, probability, urgency, next_step }]
  differential: Array<{ condition: string; probability: number; urgency: string; nextStep: string }>;

  @Column({ name: 'triage_level', nullable: true }) // emergency | urgent | routine | self_care
  triageLevel: string;

  @Column({ name: 'recommended_action', nullable: true })
  recommendedAction: string;

  @Column({ name: 'escalated_to_encounter', default: false })
  escalatedToEncounter: boolean;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
