import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { SurgicalCase } from './surgical-case.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('anesthesia_records')
export class AnesthesiaRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surgical_case_id', type: 'uuid' })
  @Index('idx_anesthesia_record_case')
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase)
  @JoinColumn({ name: 'surgical_case_id' })
  surgicalCase: SurgicalCase;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index('idx_anesthesia_record_patient')
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // Times
  @Column({ name: 'anesthesia_start_time', type: 'timestamptz' })
  anesthesiaStartTime: Date;

  @Column({ name: 'anesthesia_end_time', type: 'timestamptz', nullable: true })
  anesthesiaEndTime: Date;

  @Column({ name: 'surgery_start_time', type: 'timestamptz', nullable: true })
  surgeryStartTime: Date;

  @Column({ name: 'surgery_end_time', type: 'timestamptz', nullable: true })
  surgeryEndTime: Date;

  // Anesthesia Type
  @Column({ name: 'anesthesia_type', length: 50 })
  anesthesiaType: string;

  @Column({ name: 'airway_management', length: 50, nullable: true })
  airwayManagement: string;

  @Column({ name: 'ett_size', length: 10, nullable: true })
  ettSize: string;

  @Column({ name: 'ett_depth', length: 10, nullable: true })
  ettDepth: string;

  // Induction
  @Column({ name: 'induction_medications', type: 'jsonb', default: [] })
  inductionMedications: any[];

  @Column({ name: 'induction_notes', type: 'text', nullable: true })
  inductionNotes: string;

  // Maintenance
  @Column({ name: 'maintenance_technique', length: 50, nullable: true })
  maintenanceTechnique: string;

  @Column({ name: 'maintenance_agents', type: 'jsonb', default: [] })
  maintenanceAgents: any[];

  // Monitoring
  @Column({ name: 'monitors_used', type: 'jsonb', default: ['ECG', 'NIBP', 'SpO2', 'EtCO2', 'Temp'] })
  monitorsUsed: string[];

  // Medications Given
  @Column({ name: 'medications_administered', type: 'jsonb', default: [] })
  medicationsAdministered: any[];

  // Fluids
  @Column({ name: 'crystalloids_ml', default: 0 })
  crystalloidsMl: number;

  @Column({ name: 'colloids_ml', default: 0 })
  colloidsMl: number;

  @Column({ name: 'blood_products', type: 'jsonb', default: [] })
  bloodProducts: any[];

  // Blood Loss & Output
  @Column({ name: 'estimated_blood_loss', nullable: true })
  estimatedBloodLoss: number;

  @Column({ name: 'urine_output', nullable: true })
  urineOutput: number;

  @Column({ name: 'drain_output', nullable: true })
  drainOutput: number;

  // Ventilation
  @Column({ name: 'ventilation_mode', length: 50, nullable: true })
  ventilationMode: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  fio2: number;

  @Column({ name: 'tidal_volume', nullable: true })
  tidalVolume: number;

  @Column({ name: 'respiratory_rate', nullable: true })
  respiratoryRate: number;

  @Column({ nullable: true })
  peep: number;

  // Events & Complications
  @Column({ name: 'intraop_events', type: 'jsonb', default: [] })
  intraopEvents: any[];

  @Column({ type: 'text', nullable: true })
  complications: string;

  // Emergence
  @Column({ name: 'emergence_time', type: 'timestamptz', nullable: true })
  emergenceTime: Date;

  @Column({ name: 'extubation_time', type: 'timestamptz', nullable: true })
  extubationTime: Date;

  @Column({ name: 'emergence_medications', type: 'jsonb', default: [] })
  emergenceMedications: any[];

  @Column({ name: 'emergence_notes', type: 'text', nullable: true })
  emergenceNotes: string;

  // Staff
  @Column({ name: 'anesthesiologist_id', type: 'uuid' })
  @Index('idx_anesthesia_record_provider')
  anesthesiologistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'anesthesiologist_id' })
  anesthesiologist: User;

  @Column({ name: 'crna_id', type: 'uuid', nullable: true })
  crnaId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'crna_id' })
  crna: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
