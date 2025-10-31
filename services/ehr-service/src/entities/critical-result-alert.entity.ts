import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum CriticalValueType {
  HIGH = 'high',
  LOW = 'low',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  DISMISSED = 'dismissed'
}

@Entity('critical_result_alerts')
export class CriticalResultAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lab_order_id' })
  labOrderId: string;

  @ManyToOne(() => LabOrder)
  @JoinColumn({ name: 'lab_order_id' })
  labOrder: LabOrder;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'ordering_provider_id' })
  orderingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordering_provider_id' })
  orderingProvider: User;

  @Column({ name: 'test_code' })
  testCode: string;

  @Column({ name: 'test_name' })
  testName: string;

  @Column({ name: 'result_value' })
  resultValue: string;

  @Column({ name: 'critical_value_type', type: 'varchar' })
  criticalValueType: CriticalValueType;

  @Column({ name: 'alert_message', type: 'text' })
  alertMessage: string;

  @Column({ type: 'varchar', default: AlertStatus.PENDING })
  status: AlertStatus;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedByUser: User;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'acknowledgment_notes', type: 'text', nullable: true })
  acknowledgmentNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

