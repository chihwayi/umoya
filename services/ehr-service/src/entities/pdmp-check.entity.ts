import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('pdmp_checks')
export class PdmpCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'prescriber_id', type: 'uuid' })
  prescriberId: string;

  @Column({ name: 'drug_name', type: 'varchar', length: 200 })
  drugName: string;

  @Column({ name: 'dea_schedule', type: 'varchar', length: 10, nullable: true })
  deaSchedule: string | null;

  @Column({ name: 'morphine_milligram_equivalent', type: 'decimal', precision: 8, scale: 2, nullable: true })
  morphineMilligramEquivalent: number | null;

  @Column({ name: 'risk_level', type: 'varchar', length: 20 })
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';

  @Column({ name: 'prescriber_alerts', type: 'jsonb', default: [] })
  prescriberAlerts: Array<{ type: string; message: string; severity: string }>;

  @Column({ name: 'other_active_prescriptions', type: 'jsonb', default: [] })
  otherActivePrescriptions: Array<{ drug: string; prescriber: string; date: string; quantity: number }>;

  @Column({ name: 'dispensing_blocked', type: 'boolean', default: false })
  dispensingBlocked: boolean;

  @Column({ name: 'block_override_reason', type: 'text', nullable: true })
  blockOverrideReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
