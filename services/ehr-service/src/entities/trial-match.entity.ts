import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trial_matches')
export class TrialMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'nct_id' }) // ClinicalTrials.gov NCT number
  nctId: string;

  @Column({ name: 'trial_title' })
  trialTitle: string;

  @Column({ name: 'phase', nullable: true }) // Phase 1|2|3|4
  phase: string;

  @Column({ name: 'condition' })
  condition: string;

  @Column({ name: 'eligibility_score', type: 'float', default: 0 })
  // 0–1 AI match score
  eligibilityScore: number;

  @Column({ name: 'inclusion_met', type: 'jsonb', default: '[]' })
  inclusionMet: string[];

  @Column({ name: 'exclusion_flags', type: 'jsonb', default: '[]' })
  exclusionFlags: string[];

  @Column({ name: 'sponsor', nullable: true })
  sponsor: string;

  @Column({ name: 'locations', type: 'jsonb', default: '[]' })
  locations: string[];

  @Column({ name: 'status' }) // matched | dismissed | enrolled | not_eligible
  status: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string;

  @Column({ name: 'registry', nullable: true })
  registry: string | null;

  @Column({ name: 'registry_id', nullable: true })
  registryId: string | null;

  @CreateDateColumn({ name: 'matched_at' })
  matchedAt: Date;
}
