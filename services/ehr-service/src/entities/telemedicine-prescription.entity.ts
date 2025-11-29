import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TelemedicineConsultation } from './telemedicine-consultation.entity';
import { Prescription } from './prescription.entity';

export type SignatureMethod = 'digital_pen' | 'touch' | 'click_to_sign';

@Entity('telemedicine_prescriptions')
export class TelemedicinePrescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TelemedicineConsultation, consultation => consultation.prescriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultation_id' })
  consultation: TelemedicineConsultation;

  @Column({ name: 'consultation_id', type: 'uuid' })
  consultationId: string;

  @ManyToOne(() => Prescription, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prescription_id' })
  prescription?: Prescription;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId?: string;

  @Column({ name: 'e_signature_patient', type: 'text', nullable: true })
  eSignaturePatient?: string;

  @Column({ name: 'e_signature_doctor', type: 'text', nullable: true })
  eSignatureDoctor?: string;

  @Column({ name: 'signed_by_patient_at', type: 'timestamptz', nullable: true })
  signedByPatientAt?: Date;

  @Column({ name: 'signed_by_doctor_at', type: 'timestamptz', nullable: true })
  signedByDoctorAt?: Date;

  @Column({ name: 'signature_method', type: 'varchar', length: 20, nullable: true })
  signatureMethod?: SignatureMethod;

  @Column({ name: 'is_valid', type: 'boolean', default: false })
  isValid: boolean;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

