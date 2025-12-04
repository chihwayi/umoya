import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SurgicalCase } from './surgical-case.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('pre_anesthesia_assessments')
export class PreAnesthesiaAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surgical_case_id' })
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase)
  @JoinColumn({ name: 'surgical_case_id' })
  surgicalCase: SurgicalCase;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // ASA Physical Status
  @Column({ name: 'asa_status', length: 10, nullable: true })
  asaStatus: string;

  @Column({ name: 'asa_modifier', length: 10, nullable: true })
  asaModifier: string;

  // Airway Assessment
  @Column({ name: 'mallampati_score', nullable: true })
  mallampatiScore: number;

  @Column({ name: 'mouth_opening', length: 20, nullable: true })
  mouthOpening: string;

  @Column({ name: 'neck_mobility', length: 50, nullable: true })
  neckMobility: string;

  @Column({ name: 'thyromental_distance', length: 20, nullable: true })
  thyromentalDistance: string;

  @Column({ length: 100, nullable: true })
  dentition: string;

  @Column({ name: 'airway_risk', length: 20, nullable: true })
  airwayRisk: string;

  // Cardiovascular
  @Column({ name: 'cardiac_history', type: 'text', nullable: true })
  cardiacHistory: string;

  @Column({ name: 'cardiac_exam_findings', type: 'text', nullable: true })
  cardiacExamFindings: string;

  @Column({ name: 'ecg_findings', type: 'text', nullable: true })
  ecgFindings: string;

  @Column({ name: 'recent_ecg_date', type: 'date', nullable: true })
  recentEcgDate: Date;

  // Respiratory
  @Column({ name: 'respiratory_history', type: 'text', nullable: true })
  respiratoryHistory: string;

  @Column({ name: 'respiratory_exam_findings', type: 'text', nullable: true })
  respiratoryExamFindings: string;

  @Column({ name: 'chest_xray_findings', type: 'text', nullable: true })
  chestXrayFindings: string;

  @Column({ name: 'recent_cxr_date', type: 'date', nullable: true })
  recentCxrDate: Date;

  // Lab Values
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  hemoglobin: number;

  @Column({ name: 'platelet_count', nullable: true })
  plateletCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  inr: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  creatinine: number;

  @Column({ nullable: true })
  glucose: number;

  @Column({ name: 'recent_labs_date', type: 'date', nullable: true })
  recentLabsDate: Date;

  // Allergies & Medications
  @Column({ name: 'drug_allergies', type: 'jsonb', default: [] })
  drugAllergies: any[];

  @Column({ name: 'current_medications', type: 'jsonb', default: [] })
  currentMedications: any[];

  @Column({ name: 'last_oral_intake', type: 'timestamptz', nullable: true })
  lastOralIntake: Date;

  @Column({ name: 'npo_status', default: false })
  npoStatus: boolean;

  // Anesthesia Plan
  @Column({ name: 'planned_anesthesia_type', length: 50, nullable: true })
  plannedAnesthesiaType: string;

  @Column({ name: 'planned_airway', length: 50, nullable: true })
  plannedAirway: string;

  @Column({ name: 'special_considerations', type: 'text', nullable: true })
  specialConsiderations: string;

  // Risk Assessment
  @Column({ name: 'anesthesia_risk', length: 20, nullable: true })
  anesthesiaRisk: string;

  @Column({ name: 'risk_factors', type: 'text', nullable: true })
  riskFactors: string;

  // Comorbidities (ICD-10 codes)
  @Column({ type: 'jsonb', default: [] })
  comorbidities: any[];

  // Consent
  @Column({ name: 'anesthesia_consent_obtained', default: false })
  anesthesiaConsentObtained: boolean;

  @Column({ name: 'consent_obtained_by', nullable: true })
  consentObtainedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'consent_obtained_by' })
  consentObtainedBy: User;

  @Column({ name: 'consent_obtained_at', type: 'timestamptz', nullable: true })
  consentObtainedAt: Date;

  // Assessment
  @Column({ name: 'assessed_by' })
  assessedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assessed_by' })
  assessedBy: User;

  @Column({ name: 'assessed_at', type: 'timestamptz', default: () => 'NOW()' })
  assessedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

