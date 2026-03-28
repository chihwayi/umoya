import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('neonatal_records')
export class NeonatalRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'delivery_date', type: 'date', nullable: true }) deliveryDate?: Date;
  @Column({ name: 'delivery_type', length: 20, nullable: true }) deliveryType?: string;
  @Column({ name: 'gestational_age_weeks', type: 'numeric', precision: 4, scale: 1, nullable: true }) gestationalAgeWeeks?: number;
  @Column({ name: 'birth_weight_grams', type: 'int', nullable: true }) birthWeightGrams?: number;
  @Column({ name: 'apgar_1min', type: 'int', nullable: true }) apgar1min?: number;
  @Column({ name: 'apgar_5min', type: 'int', nullable: true }) apgar5min?: number;
  @Column({ name: 'apgar_10min', type: 'int', nullable: true }) apgar10min?: number;

  @Column({ name: 'resuscitation_required', type: 'boolean', default: false }) resuscitationRequired: boolean;
  @Column({ name: 'resuscitation_details', type: 'text', nullable: true }) resuscitationDetails?: string;
  @Column({ name: 'special_care_unit_admission', type: 'boolean', default: false }) specialCareUnitAdmission: boolean;
  @Column({ name: 'scbu_admission_reason', type: 'text', nullable: true }) scbuAdmissionReason?: string;
  @Column({ name: 'scbu_discharge_date', type: 'date', nullable: true }) scbuDischargeDate?: Date;

  @Column({ name: 'vitamin_k_given', type: 'boolean', default: false }) vitaminKGiven: boolean;
  @Column({ name: 'eye_prophylaxis_given', type: 'boolean', default: false }) eyeProphylaxisGiven: boolean;
  @Column({ name: 'hearing_screen_result', length: 20, nullable: true }) hearingScreenResult?: string;
  @Column({ name: 'metabolic_screen_result', length: 20, nullable: true }) metabolicScreenResult?: string;

  /** exposed | unexposed | unknown */
  @Column({ name: 'hiv_exposure_status', length: 20, default: 'unknown' }) hivExposureStatus: string = 'unknown';
  @Column({ name: 'arvs_given', type: 'boolean', default: false }) arvsGiven: boolean;

  @Column({ name: 'discharge_weight_grams', type: 'int', nullable: true }) dischargeWeightGrams?: number;
  @Column({ name: 'discharge_date', type: 'date', nullable: true }) dischargeDate?: Date;

  @Column({ name: 'attending_clinician_id', type: 'uuid', nullable: true }) attendingClinicianId?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'attending_clinician_id' }) attendingClinician?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
