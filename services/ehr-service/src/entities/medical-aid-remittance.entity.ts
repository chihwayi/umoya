import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('medical_aid_remittances')
export class MedicalAidRemittance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'provider_id', type: 'uuid', nullable: true })
  providerId: string | null;

  @Column({ name: 'remittance_reference', length: 150, nullable: true })
  remittanceReference: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ length: 30, default: 'received' })
  status: 'received' | 'processed' | 'error';

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload: Record<string, any>;

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

