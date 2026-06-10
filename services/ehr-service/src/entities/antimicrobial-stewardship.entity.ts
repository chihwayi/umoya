import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('antimicrobial_stewardship')
export class AntimicrobialStewardship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'prescription_id', nullable: true })
  prescriptionId: string;

  @Column({ name: 'antibiotic_name', length: 255 })
  antibioticName: string;

  @Column({ name: 'antibiotic_class', length: 100, nullable: true })
  antibioticClass: string;

  @Column({ length: 100 })
  dose: string;

  @Column({ length: 50 })
  route: string;

  @Column({ length: 100 })
  frequency: string;

  @Column({ type: 'text' })
  indication: string;

  @Column({ name: 'indication_icd10', length: 10, nullable: true })
  indicationIcd10: string;

  @Column({ name: 'empiric_or_targeted', length: 50, nullable: true })
  empiricOrTargeted: string;

  @Column({ name: 'culture_sent', default: false })
  cultureSent: boolean;

  @Column({ name: 'culture_source', length: 100, nullable: true })
  cultureSource: string;

  @Column({ name: 'culture_result', type: 'text', nullable: true })
  cultureResult: string;

  @Column({ name: 'organism_identified', length: 255, nullable: true })
  organismIdentified: string;

  @Column({ name: 'sensitivity_profile', type: 'jsonb', nullable: true })
  sensitivityProfile: any;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'planned_duration_days', nullable: true })
  plannedDurationDays: number;

  @Column({ name: 'actual_stop_date', type: 'date', nullable: true })
  actualStopDate: Date;

  @Column({ name: 'total_days_given', nullable: true })
  totalDaysGiven: number;

  @Column({ name: 'review_required', default: false })
  reviewRequired: boolean;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User;

  @Column({ name: 'stewardship_recommendation', type: 'text', nullable: true })
  stewardshipRecommendation: string;

  @Column({ name: 'recommendation_followed', nullable: true })
  recommendationFollowed: boolean;

  @Column({ name: 'appropriate_indication', nullable: true })
  appropriateIndication: boolean;

  @Column({ name: 'appropriate_dose', nullable: true })
  appropriateDose: boolean;

  @Column({ name: 'appropriate_duration', nullable: true })
  appropriateDuration: boolean;

  @Column({ name: 'de_escalation_opportunity', default: false })
  deEscalationOpportunity: boolean;

  @Column({ name: 'de_escalation_notes', type: 'text', nullable: true })
  deEscalationNotes: string;

  @Column({ name: 'prescribed_by', type: 'uuid' })
  prescribedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'prescribed_by' })
  prescribedBy: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




