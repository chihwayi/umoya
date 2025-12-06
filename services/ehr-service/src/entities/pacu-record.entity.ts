import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SurgicalCase } from './surgical-case.entity';
import { Patient } from './patient.entity';
import { AnesthesiaRecord } from './anesthesia-record.entity';
import { User } from './user.entity';

@Entity('pacu_records')
export class PacuRecord {
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

  @Column({ name: 'anesthesia_record_id', nullable: true })
  anesthesiaRecordId: string;

  @ManyToOne(() => AnesthesiaRecord)
  @JoinColumn({ name: 'anesthesia_record_id' })
  anesthesiaRecord: AnesthesiaRecord;

  // Arrival
  @Column({ name: 'arrival_time', type: 'timestamptz', default: () => 'NOW()' })
  arrivalTime: Date;

  @Column({ name: 'arrival_from', length: 50, default: 'OR' })
  arrivalFrom: string;

  // Aldrete Score
  @Column({ name: 'aldrete_score_admission', nullable: true })
  aldreteScoreAdmission: number;

  @Column({ name: 'aldrete_score_discharge', nullable: true })
  aldreteScoreDischarge: number;

  @Column({ name: 'aldrete_components', type: 'jsonb', nullable: true })
  aldreteComponents: any;

  // Pain Assessment
  @Column({ name: 'pain_score_admission', nullable: true })
  painScoreAdmission: number;

  @Column({ name: 'pain_score_discharge', nullable: true })
  painScoreDischarge: number;

  @Column({ name: 'pain_management', type: 'jsonb', default: [] })
  painManagement: any[];

  // Nausea/Vomiting
  @Column({ name: 'ponv_score', nullable: true })
  ponvScore: number;

  @Column({ name: 'antiemetics_given', type: 'jsonb', default: [] })
  antiemeticsGiven: any[];

  // Complications
  @Column({ type: 'text', nullable: true })
  complications: string;

  @Column({ type: 'jsonb', default: [] })
  interventions: any[];

  // Discharge
  @Column({ name: 'discharge_time', type: 'timestamptz', nullable: true })
  dischargeTime: Date;

  @Column({ name: 'discharged_to', length: 50, nullable: true })
  dischargedTo: string;

  @Column({ name: 'discharge_criteria_met', default: false })
  dischargeCriteriaMet: boolean;

  // Staff
  @Column({ name: 'pacu_nurse_id', nullable: true })
  pacuNurseId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'pacu_nurse_id' })
  pacuNurse: User;

  @Column({ name: 'discharge_approved_by', nullable: true })
  dischargeApprovedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'discharge_approved_by' })
  dischargeApprovedBy: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

