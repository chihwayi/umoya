import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TbaRegister } from './tba-register.entity';

@Entity({ name: 'home_birth_records' })
export class HomeBirthRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tba_id', nullable: true }) tbaId: string;
  @ManyToOne(() => TbaRegister, t => t.births)
  @JoinColumn({ name: 'tba_id' })
  tba: TbaRegister;

  @Column({ name: 'attended_by_type' }) attendedByType: string;
  @Column({ name: 'attended_by_name', nullable: true }) attendedByName: string;

  @Column({ name: 'mother_patient_id', nullable: true }) motherPatientId: string;
  @Column({ name: 'mother_name' }) motherName: string;
  @Column({ name: 'mother_phone', nullable: true }) motherPhone: string;
  @Column({ name: 'mother_village' }) motherVillage: string;
  @Column({ name: 'mother_age_years', nullable: true }) motherAgeYears: number;
  @Column({ name: 'mother_parity', nullable: true }) motherParity: number;
  @Column({ name: 'antenatal_visits', default: 0 }) antenatalVisits: number;
  @Column({ name: 'last_anc_date', type: 'date', nullable: true }) lastAncDate: string;

  @Column({ name: 'birth_date', type: 'date' }) birthDate: string;
  @Column({ name: 'birth_time', type: 'time', nullable: true }) birthTime: string;
  @Column({ name: 'birth_place_description', nullable: true }) birthPlaceDescription: string;
  @Column({ name: 'gestational_age_weeks', nullable: true }) gestationalAgeWeeks: number;

  @Column({ name: 'baby_alive', default: true }) babyAlive: boolean;
  @Column({ name: 'baby_sex', nullable: true }) babySex: string;
  @Column({ name: 'birth_weight_kg', type: 'decimal', precision: 4, scale: 2, nullable: true }) birthWeightKg: number;
  @Column({ name: 'apgar_score', nullable: true }) apgarScore: number;
  @Column({ name: 'birth_outcome' }) birthOutcome: string;
  @Column({ name: 'multiple_birth', default: false }) multipleBirth: boolean;
  @Column({ name: 'multiple_birth_count', nullable: true }) multipleBirthCount: number;

  @Column({ name: 'maternal_alive', default: true }) maternalAlive: boolean;
  @Column({ name: 'maternal_complications', type: 'jsonb', default: [] }) maternalComplications: string[];
  @Column({ name: 'maternal_complication_outcome', nullable: true }) maternalComplicationOutcome: string;

  @Column({ name: 'cord_cut_with', nullable: true }) cordCutWith: string;
  @Column({ name: 'misoprostol_given', default: false }) misoprostolGiven: boolean;
  @Column({ name: 'vitamin_k_given', default: false }) vitaminKGiven: boolean;
  @Column({ name: 'eye_care_given', default: false }) eyeCareGiven: boolean;
  @Column({ name: 'breastfeeding_initiated', nullable: true }) breastfeedingInitiated: boolean;

  @Column({ name: 'referred', default: false }) referred: boolean;
  @Column({ name: 'referral_reason', nullable: true }) referralReason: string;
  @Column({ name: 'referral_facility', nullable: true }) referralFacility: string;
  @Column({ name: 'referral_outcome', nullable: true }) referralOutcome: string;

  @Column({ name: 'crvs_notified', default: false }) crvsNotified: boolean;
  @Column({ name: 'crvs_notification_date', type: 'date', nullable: true }) crvsNotificationDate: string;
  @Column({ name: 'birth_certificate_number', nullable: true }) birthCertificateNumber: string;

  @Column({ name: 'cdss_risk_level', nullable: true }) cdssRiskLevel: string;
  @Column({ name: 'cdss_recommendation', nullable: true }) cdssRecommendation: string;
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;

  @Column({ name: 'recorded_by', nullable: true }) recordedBy: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
