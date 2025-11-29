import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('doctor_availability')
export class DoctorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string;

  @Column({ name: 'is_all_day', type: 'boolean', default: false })
  isAllDay: boolean;

  @Column({ name: 'is_unavailable', type: 'boolean', default: true })
  isUnavailable: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

