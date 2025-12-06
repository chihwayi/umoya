import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
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

  @Column({ nullable: true })
  recordNumber?: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  appointmentId: string;

  @ManyToOne(() => AppointmentSimple)
  @JoinColumn({ name: 'appointmentId' })
  appointment: AppointmentSimple;

  @Column()
  providerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'providerId' })
  provider: User;

  @Column({ type: 'enum', enum: RecordType })
  type: RecordType;

  @Column({ type: 'timestamp' })
  recordDate: Date;

  @Column({ type: 'text' })
  chiefComplaint: string;

  @Column({ type: 'text', nullable: true })
  historyOfPresentIllness: string;

  @Column({ type: 'text', nullable: true })
  physicalExamination: string;

  @Column({ type: 'text', nullable: true })
  assessment: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  @Column({ type: 'json', nullable: true })
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

  @Column({ type: 'json', nullable: true })
  diagnoses: Array<{
    code: string;
    description: string;
    type: 'primary' | 'secondary';
    icd10Code?: string;
  }>;

  @Column({ type: 'json', nullable: true })
  procedures: Array<{
    code: string;
    description: string;
    date: Date;
    provider: string;
  }>;

  @Column({ type: 'text', nullable: true })
  followUpInstructions: string;

  @Column({ type: 'json', nullable: true })
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;

  @Column({ default: false })
  isConfidential: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}