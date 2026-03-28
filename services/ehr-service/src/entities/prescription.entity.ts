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

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'doctor_id' })
  prescriberId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  prescriber: User;

  @Column({ name: 'medical_record_id', nullable: true })
  medicalRecordId?: string;

  @ManyToOne(() => MedicalRecord, { nullable: true })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord?: MedicalRecord;

  @Column({ name: 'medication_name' })
  medicationName: string;

  @Column({ name: 'medication_name_snomed_code', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedCode?: string;

  @Column({ name: 'medication_name_snomed_term', type: 'text', nullable: true })
  medicationNameSnomedTerm?: string;

  @Column({ name: 'medication_name_snomed_module_id', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedModuleId?: string;

  @Column({ name: 'medication_name_snomed_definition_status', type: 'varchar', length: 50, nullable: true })
  medicationNameSnomedDefinitionStatus?: string;

  // Note: RxNorm columns (medication_name_rxnorm_code, medication_name_rxnorm_name, medication_name_rxnorm_tty) 
  // do not exist in the database schema. These are virtual fields only.
  medicationNameRxnormCode?: string;
  medicationNameRxnormName?: string;
  medicationNameRxnormTty?: string;

  @Column()
  dosage: string;

  @Column()
  frequency: string;

  @Column({ nullable: true })
  duration?: string;

  @Column()
  quantity: number;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.ACTIVE })
  status: PrescriptionStatus;

  @Column({ name: 'prescribed_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  prescribedDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual/optional fields that don't exist in database but may be used in code
  // These are handled via type assertions when needed
  form?: MedicationForm;
  strength?: string;
  route?: string;
  refills?: number;
  startDate?: Date;
  endDate?: Date;
  indication?: string;
  pharmacyNotes?: string;
  genericName?: string;
  dispensedById?: string;
  dispensedAt?: Date;
  interactions?: Array<{
    medicationName: string;
    severity: 'minor' | 'moderate' | 'major';
    description: string;
  }>;
  allergies?: Array<{
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
}
