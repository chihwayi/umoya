import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('appointments')
export class Appointment {
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

  @Column({ name: 'duration_minutes', default: 30 })
  durationMinutes: number;

  @Column({ name: 'appointment_type', length: 100 })
  appointmentType: string;

  @Column({ length: 50, default: 'scheduled' })
  status: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'priority_level', default: 'normal' })
  priorityLevel: string;

  @Column({ name: 'virtual_meeting_url', nullable: true })
  virtualMeetingUrl: string;

  @Column({ name: 'is_telehealth', default: false })
  isTelehealth: boolean;

  @Column({ name: 'check_in_time', type: 'timestamptz', nullable: true })
  checkInTime: Date;

  @Column({ name: 'actual_start_time', type: 'timestamptz', nullable: true })
  actualStartTime: Date;

  @Column({ name: 'actual_end_time', type: 'timestamptz', nullable: true })
  actualEndTime: Date;

  @Column({ name: 'wait_time_minutes', nullable: true })
  waitTimeMinutes: number;

  @Column({ name: 'recurring_pattern', nullable: true })
  recurringPattern: string;

  @Column({ name: 'parent_appointment_id', type: 'uuid', nullable: true })
  parentAppointmentId: string;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @Column({ name: 'patient_instructions', type: 'text', nullable: true })
  patientInstructions: string;

  @Column({ name: 'preparation_notes', type: 'text', nullable: true })
  preparationNotes: string;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ name: 'insurance_verified', default: false })
  insuranceVerified: boolean;

  @Column({ name: 'reminder_sent_count', default: 0 })
  reminderSentCount: number;

  @Column({ name: 'last_reminder_sent', type: 'timestamptz', nullable: true })
  lastReminderSent: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}