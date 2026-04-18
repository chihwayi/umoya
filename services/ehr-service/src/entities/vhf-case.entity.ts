import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VhfContact } from './vhf-contact.entity';
import { MpoxLesionAssessment } from './mpox-lesion-assessment.entity';

@Entity('vhf_cases')
export class VhfCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'reported_by', type: 'uuid' })
  reportedBy: string;

  @Column({ type: 'text' })
  pathogen: string;

  @Column({ name: 'pathogen_clade', type: 'text', nullable: true })
  pathogenClade: string | null;

  @Column({ name: 'exposure_date', type: 'date', nullable: true })
  exposureDate: string | null;

  @Column({ name: 'exposure_type', type: 'text', nullable: true })
  exposureType: string | null;

  @Column({ name: 'travel_history', type: 'jsonb', default: [] })
  travelHistory: Record<string, any>[];

  @Column({ name: 'animal_exposure', type: 'jsonb', default: [] })
  animalExposure: Record<string, any>[];

  @Column({ name: 'symptom_onset_date', type: 'date', nullable: true })
  symptomOnsetDate: string | null;

  @Column({ name: 'date_reported', type: 'date' })
  dateReported: string;

  @Column({ type: 'text', default: 'suspected' })
  classification: string;

  @Column({ name: 'case_definition_met', type: 'text', nullable: true })
  caseDefinitionMet: string | null;

  @Column({ name: 'isolation_status', type: 'text', default: 'pending' })
  isolationStatus: string;

  @Column({ name: 'isolation_start_date', type: 'timestamptz', nullable: true })
  isolationStartDate: Date | null;

  @Column({ name: 'isolation_location', type: 'text', nullable: true })
  isolationLocation: string | null;

  @Column({ name: 'ppe_protocol_followed', default: false })
  ppeProtocolFollowed: boolean;

  @Column({ name: 'ppe_breaches_noted', type: 'text', nullable: true })
  ppeBreachesNoted: string | null;

  @Column({ name: 'specimen_collected', default: false })
  specimenCollected: boolean;

  @Column({ name: 'specimen_collection_date', type: 'timestamptz', nullable: true })
  specimenCollectionDate: Date | null;

  @Column({ name: 'specimen_type', type: 'text', nullable: true })
  specimenType: string | null;

  @Column({ name: 'lab_pcr_result', type: 'text', nullable: true })
  labPcrResult: string | null;

  @Column({ name: 'lab_result_date', type: 'timestamptz', nullable: true })
  labResultDate: Date | null;

  @Column({ name: 'lab_cycle_threshold', type: 'decimal', precision: 5, scale: 2, nullable: true })
  labCycleThreshold: number | null;

  @Column({ name: 'contacts_listed', type: 'int', default: 0 })
  contactsListed: number;

  @Column({ name: 'contacts_under_followup', type: 'int', default: 0 })
  contactsUnderFollowup: number;

  @Column({ name: 'notified_district_health', default: false })
  notifiedDistrictHealth: boolean;

  @Column({ name: 'notified_national_health', default: false })
  notifiedNationalHealth: boolean;

  @Column({ name: 'notified_who', default: false })
  notifiedWho: boolean;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @Column({ name: 'who_event_id', type: 'text', nullable: true })
  whoEventId: string | null;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ name: 'outcome_date', type: 'date', nullable: true })
  outcomeDate: string | null;

  @Column({ name: 'case_fatality', default: false })
  caseFatality: boolean;

  @OneToMany(() => VhfContact, (contact) => contact.case)
  contacts?: VhfContact[];

  @OneToMany(() => MpoxLesionAssessment, (assessment) => assessment.vhfCase)
  lesionAssessments?: MpoxLesionAssessment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
