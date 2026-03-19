import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('tb_patients')
export class TbPatient {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'tb_register_number', length: 50, nullable: true }) tbRegisterNumber?: string;
  @Column({ name: 'notification_date', type: 'date', nullable: true }) notificationDate?: Date;
  @Column({ name: 'registration_date', type: 'date', default: () => 'CURRENT_DATE' }) registrationDate: Date;

  /** pulmonary | extrapulmonary | mdr | xdr | other */
  @Column({ name: 'case_type', length: 30, default: 'pulmonary' }) caseType: string = 'pulmonary';
  /** new | relapse | treatment_after_failure | treatment_after_ltfu | other_previously_treated | unknown */
  @Column({ name: 'treatment_category', length: 20, default: 'new' }) treatmentCategory: string = 'new';
  /** positive | negative | unknown */
  @Column({ name: 'hiv_status', length: 20, default: 'unknown' }) hivStatus: string = 'unknown';
  @Column({ name: 'art_started', type: 'boolean', default: false }) artStarted: boolean;
  @Column({ name: 'ipt_started', type: 'boolean', default: false }) iptStarted: boolean;
  @Column({ name: 'anatomical_site', length: 100, nullable: true }) anatomicalSite?: string;
  @Column({ name: 'referred_from', length: 100, nullable: true }) referredFrom?: string;
  @Column({ name: 'treating_facility', length: 100, nullable: true }) treatingFacility?: string;

  @Column({ name: 'case_officer_id', type: 'uuid', nullable: true }) caseOfficerId?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'case_officer_id' }) caseOfficer?: User;

  /** on_treatment | completed | cured | failed | died | ltfu | transferred_out | not_evaluated */
  @Column({ length: 30, default: 'on_treatment' }) status: string = 'on_treatment';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
