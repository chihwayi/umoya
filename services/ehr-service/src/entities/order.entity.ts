import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { AppointmentSimple } from './appointment-simple.entity';

export enum OrderType {
  MEDICATION = 'medication',
  PROCEDURE = 'procedure',
  LAB_TEST = 'lab_test',
  IMAGING = 'imaging',
  CONSULTATION = 'consultation',
  DIET = 'diet',
  ACTIVITY = 'activity'
}

export enum OrderStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected'
}

export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'appointment_id', nullable: true })
  appointmentId?: string;

  @ManyToOne(() => AppointmentSimple, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: AppointmentSimple;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ 
    name: 'order_type',
    type: 'enum',
    enum: OrderType
  })
  orderType: OrderType;

  @Column({ name: 'order_name' })
  orderName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ nullable: true })
  dosage?: string;

  @Column({ nullable: true })
  frequency?: string;

  @Column({ nullable: true })
  duration?: string;

  @Column({ 
    name: 'priority',
    type: 'enum',
    enum: OrderPriority,
    default: OrderPriority.NORMAL
  })
  priority: OrderPriority;

  @Column({ 
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING
  })
  status: OrderStatus;

  @Column({ name: 'authorized_by', nullable: true })
  authorizedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'authorized_by' })
  authorizedByUser?: User;

  @Column({ name: 'authorized_at', type: 'timestamp', nullable: true })
  authorizedAt?: Date;

  @Column({ name: 'executed_by', nullable: true })
  executedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'executed_by' })
  executedByUser?: User;

  @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
  executedAt?: Date;

  @Column({ name: 'execution_notes', type: 'text', nullable: true })
  executionNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
