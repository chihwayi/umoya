import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Appointment } from './appointment.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { TelemedicineTechnicalLog } from './telemedicine-technical-log.entity';
import { TelemedicinePrescription } from './telemedicine-prescription.entity';

export type ConsultationType = 'video' | 'audio' | 'chat' | 'hybrid';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';
export type ConsultationStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'technical_issue';

@Entity('telemedicine_consultations')
export class TelemedicineConsultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @Column({ name: 'consultation_type', type: 'varchar', length: 20, default: 'video' })
  consultationType: ConsultationType;

  @Column({ name: 'meeting_room_id', type: 'varchar', length: 255, unique: true, nullable: true })
  meetingRoomId?: string;

  @Column({ name: 'meeting_url', type: 'text', nullable: true })
  meetingUrl?: string;

  @Column({ name: 'meeting_password', type: 'varchar', length: 100, nullable: true })
  meetingPassword?: string;

  @Column({ name: 'scheduled_start_time', type: 'timestamptz' })
  scheduledStartTime: Date;

  @Column({ name: 'actual_start_time', type: 'timestamptz', nullable: true })
  actualStartTime?: Date;

  @Column({ name: 'actual_end_time', type: 'timestamptz', nullable: true })
  actualEndTime?: Date;

  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  durationMinutes?: number;

  @Column({ name: 'connection_quality', type: 'varchar', length: 20, nullable: true })
  connectionQuality?: ConnectionQuality;

  @Column({ name: 'doctor_connection_quality', type: 'varchar', length: 20, nullable: true })
  doctorConnectionQuality?: ConnectionQuality;

  @Column({ name: 'patient_joined', type: 'boolean', default: false })
  patientJoined: boolean;

  @Column({ name: 'patient_join_time', type: 'timestamptz', nullable: true })
  patientJoinTime?: Date;

  @Column({ name: 'doctor_joined', type: 'boolean', default: false })
  doctorJoined: boolean;

  @Column({ name: 'doctor_join_time', type: 'timestamptz', nullable: true })
  doctorJoinTime?: Date;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: ConsultationStatus;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ name: 'technical_issues', type: 'text', nullable: true })
  technicalIssues?: string;

  @Column({ name: 'patient_consent', type: 'boolean', default: false })
  patientConsent: boolean;

  @Column({ name: 'consent_date', type: 'timestamptz', nullable: true })
  consentDate?: Date;

  @Column({ name: 'recording_enabled', type: 'boolean', default: false })
  recordingEnabled: boolean;

  @Column({ name: 'recording_url', type: 'text', nullable: true })
  recordingUrl?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'satisfaction_rating', type: 'integer', nullable: true })
  satisfactionRating?: number;

  @Column({ name: 'satisfaction_feedback', type: 'text', nullable: true })
  satisfactionFeedback?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: User;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById?: string;

  @OneToMany(() => TelemedicineTechnicalLog, log => log.consultation)
  technicalLogs: TelemedicineTechnicalLog[];

  @OneToMany(() => TelemedicinePrescription, prescription => prescription.consultation)
  prescriptions: TelemedicinePrescription[];
  @Column({ name: 'recording_download_url', type: 'text', nullable: true })
  recordingDownloadUrl?: string;

  @Column({ name: 'recording_fetched_at', type: 'timestamptz', nullable: true })
  recordingFetchedAt?: Date;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt?: Date;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

