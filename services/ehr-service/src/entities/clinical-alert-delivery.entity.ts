import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('clinical_alert_deliveries')
export class ClinicalAlertDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_type' }) // deterioration | sepsis | lab_critical | readmission | iot_alert
  alertType: string;

  @Column({ name: 'source_entity_id' }) // prediction_id / lab_result_id etc.
  sourceEntityId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'recipient_user_id' })
  recipientUserId: string;

  @Column({ name: 'recipient_role', nullable: true }) // doctor | nurse | on_call
  recipientRole: string;

  @Column({ name: 'severity' }) // critical | high | medium
  severity: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'payload', type: 'jsonb', default: '{}' })
  payload: Record<string, any>;

  // Delivery channels
  @Column({ name: 'websocket_sent', default: false })
  websocketSent: boolean;

  @Column({ name: 'fcm_sent', default: false })
  fcmSent: boolean;

  @Column({ name: 'sms_sent', default: false })
  smsSent: boolean;

  @Column({ name: 'acknowledged', default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
