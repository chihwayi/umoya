import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { MedicationAdministrationRecord } from './medication-administration-record.entity';

@Entity('medication_alerts')
export class MedicationAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'prescription_id', nullable: true })
  prescriptionId: string;

  @Column({ name: 'mar_id', nullable: true })
  marId: string;

  @ManyToOne(() => MedicationAdministrationRecord)
  @JoinColumn({ name: 'mar_id' })
  mar: MedicationAdministrationRecord;

  @Column({ name: 'alert_type', length: 50 })
  alertType: string;

  @Column({ length: 20 })
  severity: string;

  @Column({ name: 'alert_message', type: 'text' })
  alertMessage: string;

  @Column({ name: 'alert_details', type: 'jsonb', nullable: true })
  alertDetails: any;

  // Response
  @Column({ default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedBy: User;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

