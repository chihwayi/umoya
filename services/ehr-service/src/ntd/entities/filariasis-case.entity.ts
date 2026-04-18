import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'filariasis_cases' })
export class FilariasisCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'registered_by' }) registeredBy: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'disease_type' }) diseaseType: string;
  @Column({ name: 'mf_count_per_ml', nullable: true }) mfCountPerMl: number;
  @Column({ name: 'mf_test_method', nullable: true }) mfTestMethod: string;
  @Column({ name: 'mf_test_date', type: 'date', nullable: true }) mfTestDate: string;
  @Column({ name: 'antigen_card_test', nullable: true }) antigenCardTest: string;
  @Column({ name: 'lymphoedema_stage', nullable: true }) lymphoedemaStage: number;
  @Column({ name: 'lymphoedema_sites', type: 'jsonb', default: [] }) lymphoedemaSites: string[];
  @Column({ name: 'hydrocele', default: false }) hydrocele: boolean;
  @Column({ name: 'hydrocele_side', nullable: true }) hydroceleSide: string;
  @Column({ name: 'acute_adenolymphangitis_episodes', default: 0 }) acuteAdenolymphangitisEpisodes: number;
  @Column({ name: 'calabar_swelling', default: false }) calabarSwelling: boolean;
  @Column({ name: 'subconjunctival_worm', default: false }) subconjunctival_worm: boolean;
  @Column({ name: 'loa_loa_mf_count', nullable: true }) loaLoaMfCount: number;
  @Column({ name: 'dec_dose_mg', type: 'decimal', precision: 6, scale: 2, nullable: true }) decDoseMg: number;
  @Column({ name: 'albendazole_dose_mg', type: 'decimal', precision: 6, scale: 2, nullable: true }) albendazoleDoseMg: number;
  @Column({ name: 'ivermectin_dose_mg', type: 'decimal', precision: 6, scale: 2, nullable: true }) ivermectinDoseMg: number;
  @Column({ name: 'mda_round', nullable: true }) mdaRound: number;
  @Column({ name: 'last_treatment_date', type: 'date', nullable: true }) lastTreatmentDate: string;
  @Column({ name: 'treatment_safe', nullable: true }) treatmentSafe: boolean;
  @Column({ name: 'treatment_contraindication', nullable: true }) treatmentContraindication: string;
  @Column({ name: 'lymphoedema_hygiene_education', default: false }) lymphoedemaHygieneEducation: boolean;
  @Column({ name: 'hydrocelectomy_referral', default: false }) hydrocelectomyReferral: boolean;
  @Column({ name: 'espen_programme', nullable: true }) espenProgramme: string;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
