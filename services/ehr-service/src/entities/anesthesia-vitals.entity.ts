import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { AnesthesiaRecord } from './anesthesia-record.entity';
import { User } from './user.entity';

@Entity('anesthesia_vitals')
@Index(['anesthesiaRecordId', 'chartTime'], { unique: true })
export class AnesthesiaVitals {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'anesthesia_record_id' })
  anesthesiaRecordId: string;

  @ManyToOne(() => AnesthesiaRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anesthesia_record_id' })
  anesthesiaRecord: AnesthesiaRecord;

  @Column({ name: 'chart_time', type: 'timestamptz' })
  chartTime: Date;

  // Cardiovascular
  @Column({ name: 'heart_rate', nullable: true })
  heartRate: number;

  @Column({ name: 'blood_pressure_systolic', nullable: true })
  bloodPressureSystolic: number;

  @Column({ name: 'blood_pressure_diastolic', nullable: true })
  bloodPressureDiastolic: number;

  @Column({ name: 'blood_pressure_mean', nullable: true })
  bloodPressureMean: number;

  // Respiratory
  @Column({ name: 'respiratory_rate', nullable: true })
  respiratoryRate: number;

  @Column({ nullable: true })
  spo2: number;

  @Column({ nullable: true })
  etco2: number;

  // Temperature
  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  temperature: number;

  // Anesthesia Depth
  @Column({ name: 'bis_value', nullable: true })
  bisValue: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  mac: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'recorded_by', nullable: true })
  recordedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

