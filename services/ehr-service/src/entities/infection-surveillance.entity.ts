import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('infection_surveillance')
export class InfectionSurveillance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @Column({ name: 'infection_type', length: 100 })
  infectionType: string;

  @Column({ name: 'infection_site', length: 100, nullable: true })
  infectionSite: string;

  @Column({ name: 'infection_date', type: 'date' })
  infectionDate: Date;

  @Column({ name: 'onset_type', length: 50, nullable: true })
  onsetType: string;

  @Column({ name: 'days_since_admission', nullable: true })
  daysSinceAdmission: number;

  @Column({ length: 255, nullable: true })
  organism: string;

  @Column({ name: 'culture_source', length: 100, nullable: true })
  cultureSource: string;

  @Column({ name: 'culture_date', type: 'date', nullable: true })
  cultureDate: Date;

  @Column({ name: 'antibiotic_resistance', type: 'jsonb', default: [] })
  antibioticResistance: any[];

  @Column({ name: 'risk_factors', type: 'jsonb', default: [] })
  riskFactors: any[];

  @Column({ name: 'device_associated', default: false })
  deviceAssociated: boolean;

  @Column({ name: 'device_type', length: 100, nullable: true })
  deviceType: string;

  @Column({ name: 'infection_icd10', length: 10, nullable: true })
  infectionIcd10: string;

  @Column({ length: 50, nullable: true })
  severity: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolution_date', type: 'date', nullable: true })
  resolutionDate: Date;

  @Column({ length: 50, nullable: true })
  outcome: string;

  @Column({ name: 'reported_to_cdc', default: false })
  reportedToCdc: boolean;

  @Column({ name: 'reported_date', type: 'date', nullable: true })
  reportedDate: Date;

  @Column({ default: false })
  investigated: boolean;

  @Column({ name: 'investigation_notes', type: 'text', nullable: true })
  investigationNotes: string;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string;

  @Column({ name: 'detected_by', nullable: true })
  detectedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'detected_by' })
  detectedBy: User;

  @Column({ name: 'detected_date', type: 'date', default: () => 'CURRENT_DATE' })
  detectedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




