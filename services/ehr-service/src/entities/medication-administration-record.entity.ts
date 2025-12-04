import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('medication_administration_records')
export class MedicationAdministrationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prescription_id' })
  prescriptionId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // Medication Details
  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'medication_barcode', length: 100, nullable: true })
  medicationBarcode: string;

  @Column({ length: 100 })
  dose: string;

  @Column({ length: 50 })
  unit: string;

  @Column({ length: 50 })
  route: string;

  // 5 Rights Verification
  @Column({ name: 'right_patient_verified', default: false })
  rightPatientVerified: boolean;

  @Column({ name: 'right_medication_verified', default: false })
  rightMedicationVerified: boolean;

  @Column({ name: 'right_dose_verified', default: false })
  rightDoseVerified: boolean;

  @Column({ name: 'right_route_verified', default: false })
  rightRouteVerified: boolean;

  @Column({ name: 'right_time_verified', default: false })
  rightTimeVerified: boolean;

  // Barcode Scans
  @Column({ name: 'patient_wristband_scanned', default: false })
  patientWristbandScanned: boolean;

  @Column({ name: 'patient_barcode', length: 100, nullable: true })
  patientBarcode: string;

  @Column({ name: 'medication_barcode_scanned', default: false })
  medicationBarcodeScanned: boolean;

  @Column({ name: 'scan_timestamp', type: 'timestamptz', nullable: true })
  scanTimestamp: Date;

  // Scheduled vs Actual
  @Column({ name: 'scheduled_time', type: 'timestamptz' })
  scheduledTime: Date;

  @Column({ name: 'actual_administration_time', type: 'timestamptz', default: () => 'NOW()' })
  actualAdministrationTime: Date;

  @Column({ name: 'administration_status', length: 50, default: 'pending' })
  administrationStatus: string;

  // Administration Details
  @Column({ name: 'administered_by' })
  administeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'administered_by' })
  administeredBy: User;

  @Column({ name: 'witnessed_by', nullable: true })
  witnessedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'witnessed_by' })
  witnessedBy: User;

  @Column({ name: 'administration_site', length: 100, nullable: true })
  administrationSite: string;

  // Patient Response
  @Column({ name: 'patient_response', type: 'text', nullable: true })
  patientResponse: string;

  @Column({ name: 'adverse_reaction', default: false })
  adverseReaction: boolean;

  @Column({ name: 'adverse_reaction_details', type: 'text', nullable: true })
  adverseReactionDetails: string;

  // Refusal/Omission
  @Column({ name: 'refusal_reason', type: 'text', nullable: true })
  refusalReason: string;

  @Column({ name: 'omission_reason', type: 'text', nullable: true })
  omissionReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

