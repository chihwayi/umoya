import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'yellow_fever_cases' })
export class YellowFeverCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'reported_by' }) reportedBy: string;
  @Column({ name: 'vaccination_status' }) vaccinationStatus: string;
  @Column({ name: 'last_vaccine_date', type: 'date', nullable: true }) lastVaccineDate: string;
  @Column({ name: 'icvp_number', nullable: true }) icvpNumber: string;
  @Column({ name: 'travel_history', type: 'jsonb', default: [] }) travelHistory: object[];
  @Column({ name: 'mosquito_exposure_area', nullable: true }) mosquitoExposureArea: string;
  @Column({ name: 'onset_date', type: 'date', nullable: true }) onsetDate: string;
  @Column({ name: 'date_reported', type: 'date' }) dateReported: string;
  @Column({ name: 'phase', default: 'infection' }) phase: string;
  @Column({ name: 'jaundice_onset', type: 'date', nullable: true }) jaundiceOnset: string;
  @Column({ name: 'haemorrhage', default: false }) haemorrhage: boolean;
  @Column({ name: 'haemorrhage_sites', type: 'jsonb', default: [] }) haemorrhageSites: string[];
  @Column({ name: 'renal_failure', default: false }) renalFailure: boolean;
  @Column({ name: 'hepatic_failure', default: false }) hepaticFailure: boolean;
  @Column({ name: 'bilirubin_umol_l', type: 'decimal', precision: 6, scale: 2, nullable: true }) bilirubinUmolL: number;
  @Column({ name: 'alt_u_l', type: 'decimal', precision: 6, scale: 2, nullable: true }) altUL: number;
  @Column({ name: 'ast_u_l', type: 'decimal', precision: 6, scale: 2, nullable: true }) astUL: number;
  @Column({ name: 'creatinine_umol_l', type: 'decimal', precision: 6, scale: 2, nullable: true }) creatinineUmolL: number;
  @Column({ name: 'platelet_count', nullable: true }) plateletCount: number;
  @Column({ name: 'igm_result', nullable: true }) igmResult: string;
  @Column({ name: 'pcr_result', nullable: true }) pcrResult: string;
  @Column({ name: 'lab_result_date', type: 'date', nullable: true }) labResultDate: string;
  @Column({ name: 'notified_district', default: false }) notifiedDistrict: boolean;
  @Column({ name: 'notified_who', default: false }) notifiedWho: boolean;
  @Column({ name: 'who_notified_at', type: 'timestamp', nullable: true }) whoNotifiedAt: Date;
  @Column({ name: 'who_event_id', nullable: true }) whoEventId: string;
  @Column({ name: 'classification', default: 'suspected' }) classification: string;
  @Column({ name: 'who_severity_score', nullable: true }) whoSeverityScore: string;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @Column({ name: 'outcome_date', type: 'date', nullable: true }) outcomeDate: string;
  @Column({ name: 'case_fatality', default: false }) caseFatality: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
