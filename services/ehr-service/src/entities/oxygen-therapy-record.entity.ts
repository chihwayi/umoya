import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('oxygen_therapy_records')
export class OxygenTherapyRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'prescribed_by', type: 'uuid' }) prescribedBy: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate: string;
  @Column({ name: 'delivery_device', type: 'text' }) deliveryDevice: string;
  @Column({ name: 'flow_rate_lpm', type: 'numeric', precision: 4, scale: 1 }) flowRateLpm: number;
  @Column({ name: 'fio2_percent', type: 'numeric', precision: 5, scale: 2, nullable: true }) fio2Percent: number;
  @Column({ name: 'target_spo2_min', type: 'smallint', default: 88 }) targetSpo2Min: number;
  @Column({ name: 'target_spo2_max', type: 'smallint', default: 92 }) targetSpo2Max: number;
  @Column({ type: 'text' }) indication: string;
  @Column({ name: 'spo2_on_therapy', type: 'numeric', precision: 4, scale: 1, nullable: true }) spo2OnTherapy: number;
  @Column({ name: 'pao2_on_therapy', type: 'numeric', precision: 5, scale: 1, nullable: true }) pao2OnTherapy: number;
  @Column({ name: 'paco2_on_therapy', type: 'numeric', precision: 5, scale: 1, nullable: true }) paco2OnTherapy: number;
  @Column({ type: 'text', default: 'active' }) status: string;
  @Column({ name: 'weaning_plan', type: 'text', nullable: true }) weaningPlan: string;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'flow_rate_l_min', type: 'numeric', precision: 4, scale: 1, nullable: true })
  flowRateLMin?: number;

  @Column({ name: 'hours_per_day', type: 'int', nullable: true })
  hoursPerDay?: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: true, default: true })
  isActive: boolean = true;

  @Column({ name: 'prescription_date', type: 'date' })
  prescriptionDate: Date;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate?: Date;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
