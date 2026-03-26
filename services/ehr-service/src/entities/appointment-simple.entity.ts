import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('appointments')
export class AppointmentSimple {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ name: 'appointment_date', type: 'timestamptz' })
  appointmentDate: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 30 })
  durationMinutes: number;

  @Column({ name: 'appointment_type', length: 100 })
  appointmentType: string;

  @Column({ length: 50, default: 'scheduled' })
  status: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'patient_instructions', type: 'text', nullable: true })
  patientInstructions?: string;

  @Column({ name: 'priority_level', length: 50, default: 'normal' })
  priorityLevel: string;

  @Column({ name: 'virtual_meeting_url', length: 500, nullable: true })
  virtualMeetingUrl?: string;

  @Column({ name: 'is_telehealth', type: 'boolean', default: false })
  isTelehealth: boolean;

  @Column({ name: 'fee_amount', type: 'numeric', nullable: true })
  feeAmount: number | null;

  @Column({ name: 'finance_transaction_id', type: 'uuid', nullable: true })
  financeTransactionId: string | null;

  @Column({ name: 'payment_status', length: 50, default: 'payment_confirmed' })
  paymentStatus: string;

  @Column({ name: 'check_in_time', type: 'timestamptz', nullable: true })
  checkInTime?: Date;

  @Column({ name: 'actual_start_time', type: 'timestamptz', nullable: true })
  actualStartTime?: Date;

  @Column({ name: 'actual_end_time', type: 'timestamptz', nullable: true })
  actualEndTime?: Date;

  @Column({ name: 'wait_time_minutes', type: 'int', nullable: true })
  waitTimeMinutes?: number;

  @Column({ name: 'recurring_pattern', length: 100, nullable: true })
  recurringPattern?: string;

  @Column({ name: 'parent_appointment_id', type: 'uuid', nullable: true })
  parentAppointmentId?: string;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ name: 'preparation_notes', type: 'text', nullable: true })
  preparationNotes?: string;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost?: number;

  @Column({ name: 'insurance_verified', type: 'boolean', default: false })
  insuranceVerified: boolean;

  @Column({ name: 'reminder_sent_count', type: 'int', default: 0 })
  reminderSentCount: number;

  @Column({ name: 'last_reminder_sent', type: 'timestamptz', nullable: true })
  lastReminderSent?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
  @Column({ name: 'ai_recommended_duration', type: 'int', nullable: true })
  aiRecommendedDuration?: number;

  @Column({ name: 'diagnosis_codes', type: 'text', array: true, nullable: true })
  diagnosisCodes?: string[];

  @Column({ name: 'diagnosis_snomed_code', type: 'varchar', length: 50, nullable: true })
  diagnosisSnomedCode?: string;

  @Column({ name: 'diagnosis_snomed_term', type: 'text', nullable: true })
  diagnosisSnomedTerm?: string;

  @Column({ name: 'no_show_risk', type: 'varchar', length: 20, nullable: true })
  noShowRisk?: string;

  @Column({ name: 'overbooking_slot', type: 'boolean', nullable: true, default: false })
  overbookingSlot: boolean = false;

  @Column({ name: 'primary_diagnosis_code', type: 'varchar', length: 50, nullable: true })
  primaryDiagnosisCode?: string;

  @Column({ name: 'primary_diagnosis_description', type: 'text', nullable: true })
  primaryDiagnosisDescription?: string;

  @Column({ name: 'who_smart_form_data', type: 'jsonb', nullable: true })
  whoSmartFormData?: any;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
