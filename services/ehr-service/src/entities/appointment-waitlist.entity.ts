import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { Appointment } from './appointment.entity';

@Entity('appointment_waitlist')
export class AppointmentWaitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor?: User;

  @Column({ name: 'appointment_type', length: 100, nullable: true })
  appointmentType?: string;

  @Column({ name: 'preferred_date', type: 'date', nullable: true })
  preferredDate?: Date;

  @Column({ name: 'preferred_time_start', type: 'time', nullable: true })
  preferredTimeStart?: string;

  @Column({ name: 'preferred_time_end', type: 'time', nullable: true })
  preferredTimeEnd?: string;

  @Column({ name: 'priority', default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'notified' | 'scheduled' | 'cancelled' | 'expired';

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date;

  @Column({ name: 'scheduled_appointment_id', type: 'uuid', nullable: true })
  scheduledAppointmentId?: string;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'scheduled_appointment_id' })
  scheduledAppointment?: Appointment;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

