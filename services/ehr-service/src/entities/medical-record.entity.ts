import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { AppointmentSimple } from './appointment-simple.entity';

export enum RecordType {
  CONSULTATION = 'consultation',
  DIAGNOSIS = 'diagnosis',
  TREATMENT = 'treatment',
  PROCEDURE = 'procedure',
  LAB_RESULT = 'lab_result',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  VACCINATION = 'vaccination',
  DISCHARGE = 'discharge'
}

@Entity('medical_records')
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_number', nullable: true })
  recordNumber?: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index('idx_medical_records_patient_id')
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string | null;

  @ManyToOne(() => AppointmentSimple, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: AppointmentSimple | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  providerId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  provider?: User | null;

  @Column({ name: 'record_type', type: 'enum', enum: RecordType })
  @Index('idx_medical_records_type')
  type: RecordType;

  @Column({ name: 'visit_date', type: 'timestamptz', nullable: true })
  recordDate?: Date | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint?: string | null;

  @Column({ name: 'history_present_illness', type: 'text', nullable: true })
  historyOfPresentIllness?: string | null;

  @Column({ name: 'physical_examination', type: 'text', nullable: true })
  physicalExamination?: string | null;

  @Column({ type: 'text', nullable: true })
  assessment?: string | null;

  @Column({ type: 'text', nullable: true })
  plan?: string | null;

  @Column({ name: 'vital_signs', type: 'jsonb', nullable: true })
  vitalSigns: {
    temperature?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  diagnoses: Array<{
    code: string;
    description: string;
    type: 'primary' | 'secondary';
    icd10Code?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  procedures: Array<{
    code: string;
    description: string;
    date: Date;
    provider: string;
  }>;

  @Column({ name: 'follow_up_instructions', type: 'text', nullable: true })
  followUpInstructions?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;

  @Column({ name: 'is_confidential', default: false })
  isConfidential: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath?: string | null;

  @Column({ name: 'file_type', type: 'varchar', length: 100, nullable: true })
  fileType?: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize?: number | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User | null;

  @Column({ name: 'who_smart_form_data', type: 'jsonb', nullable: true })
  whoSmartFormData?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
