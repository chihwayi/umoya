import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('family_council_consents')
export class FamilyCouncilConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @Column({ name: 'meeting_date', type: 'timestamp', default: () => 'NOW()' })
  meetingDate: Date;

  @Column({ name: 'meeting_facilitated_by', type: 'uuid', nullable: true })
  meetingFacilitatedBy: string | null;

  @Column({ name: 'family_members_present', type: 'jsonb', default: () => "'[]'" })
  familyMembersPresent: Array<Record<string, any>>;

  @Column({ name: 'community_elder_present', type: 'boolean', default: false })
  communityElderPresent: boolean;

  @Column({ name: 'traditional_healer_present', type: 'boolean', default: false })
  traditionalHealerPresent: boolean;

  @Column({ name: 'religious_leader_present', type: 'boolean', default: false })
  religiousLeaderPresent: boolean;

  @Column({ name: 'decision_type', type: 'text' })
  decisionType: string;

  @Column({ name: 'clinical_information_shared', type: 'text' })
  clinicalInformationShared: string;

  @Column({ name: 'patient_capacity_assessed', type: 'boolean', default: true })
  patientCapacityAssessed: boolean;

  @Column({ name: 'patient_has_capacity', type: 'boolean', default: true })
  patientHasCapacity: boolean;

  @Column({ name: 'consensus_reached', type: 'boolean' })
  consensusReached: boolean;

  @Column({ name: 'decision_made', type: 'text' })
  decisionMade: string;

  @Column({ name: 'patient_agrees', type: 'boolean', nullable: true })
  patientAgrees: boolean | null;

  @Column({ name: 'cultural_conflict_noted', type: 'boolean', default: false })
  culturalConflictNoted: boolean;

  @Column({ name: 'cultural_conflict_description', type: 'text', nullable: true })
  culturalConflictDescription: string | null;

  @Column({ name: 'ethics_consultation_requested', type: 'boolean', default: false })
  ethicsConsultationRequested: boolean;

  @Column({ name: 'documented_by', type: 'uuid', nullable: true })
  documentedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
