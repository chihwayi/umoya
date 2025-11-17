import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { MedicalRecord } from './medical-record.entity';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum MedicationForm {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  LIQUID = 'liquid',
  INJECTION = 'injection',
  CREAM = 'cream',
  OINTMENT = 'ointment',
  DROPS = 'drops',
  INHALER = 'inhaler',
  PATCH = 'patch'
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionNumber: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  prescriberId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'prescriberId' })
  prescriber: User;

  @Column({ nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord)
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column()
  medicationName: string;

  @Column({ name: 'medication_name_snomed_code', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedCode?: string;

  @Column({ name: 'medication_name_snomed_term', type: 'text', nullable: true })
  medicationNameSnomedTerm?: string;

  @Column({ name: 'medication_name_snomed_module_id', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedModuleId?: string;

  @Column({ name: 'medication_name_snomed_definition_status', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedDefinitionStatus?: string;

  @Column({ nullable: true })
  genericName: string;

  @Column()
  strength: string;

  @Column({ type: 'enum', enum: MedicationForm })
  form: MedicationForm;

  @Column()
  dosage: string;

  @Column()
  frequency: string;

  @Column()
  route: string;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  refills: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'text', nullable: true })
  indication: string;

  @Column({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.ACTIVE })
  status: PrescriptionStatus;

  @Column({ type: 'text', nullable: true })
  pharmacyNotes: string;

  @Column({ nullable: true })
  dispensedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dispensedById' })
  dispensedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  dispensedAt: Date;

  @Column({ type: 'json', nullable: true })
  interactions: Array<{
    medicationName: string;
    severity: 'minor' | 'moderate' | 'major';
    description: string;
  }>;

  @Column({ type: 'json', nullable: true })
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}