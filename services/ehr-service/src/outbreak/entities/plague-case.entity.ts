import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'plague_cases' })
export class PlagueCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'reported_by' }) reportedBy: string;
  @Column({ name: 'form' }) form: string;
  @Column({ name: 'flea_exposure', default: false }) fleaExposure: boolean;
  @Column({ name: 'rodent_contact', default: false }) rodentContact: boolean;
  @Column({ name: 'pneumonic_contact', default: false }) pneumonicContact: boolean;
  @Column({ name: 'travel_endemic_area', default: false }) travelEndemicArea: boolean;
  @Column({ name: 'travel_country', nullable: true }) travelCountry: string;
  @Column({ name: 'onset_date', type: 'date', nullable: true }) onsetDate: string;
  @Column({ name: 'date_reported', type: 'date' }) dateReported: string;
  @Column({ name: 'bubo_location', nullable: true }) buboLocation: string;
  @Column({ name: 'bubo_size_cm', type: 'decimal', precision: 4, scale: 1, nullable: true }) buboSizeCm: number;
  @Column({ name: 'specimen_type', nullable: true }) specimenType: string;
  @Column({ name: 'lab_culture_result', nullable: true }) labCultureResult: string;
  @Column({ name: 'lab_pcr_result', nullable: true }) labPcrResult: string;
  @Column({ name: 'lab_result_date', type: 'date', nullable: true }) labResultDate: string;
  @Column({ name: 'gentamicin_started_at', type: 'timestamp', nullable: true }) gentamicinStartedAt: Date;
  @Column({ name: 'doxycycline_started_at', type: 'timestamp', nullable: true }) doxycyclineStartedAt: Date;
  @Column({ name: 'ciprofloxacin_started_at', type: 'timestamp', nullable: true }) ciprofloxacinStartedAt: Date;
  @Column({ name: 'treatment_response', nullable: true }) treatmentResponse: string;
  @Column({ name: 'contacts_notified', default: 0 }) contactsNotified: number;
  @Column({ name: 'prophylaxis_given', type: 'jsonb', default: [] }) prophylaxisGiven: object[];
  @Column({ name: 'notified_district', default: false }) notifiedDistrict: boolean;
  @Column({ name: 'notified_national', default: false }) notifiedNational: boolean;
  @Column({ name: 'notified_who', default: false }) notifiedWho: boolean;
  @Column({ name: 'notified_at', type: 'timestamp', nullable: true }) notifiedAt: Date;
  @Column({ name: 'classification', default: 'suspected' }) classification: string;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @Column({ name: 'outcome_date', type: 'date', nullable: true }) outcomeDate: string;
  @Column({ name: 'case_fatality', default: false }) caseFatality: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
