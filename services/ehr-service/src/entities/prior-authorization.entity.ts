import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('prior_authorizations')
export class PriorAuthorization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'payer_name', length: 255, nullable: true })
  payerName: string | null;

  @Column({ name: 'authorization_type', length: 50, nullable: true })
  authorizationType: string | null;

  @Column({ name: 'service_description', type: 'text' })
  serviceDescription: string;

  @Column({ name: 'cpt_code', length: 10, nullable: true })
  cptCode: string | null;

  @Column({ name: 'icd10_code', length: 10, nullable: true })
  icd10Code: string | null;

  @Index()
  @Column({ length: 30, default: 'draft' })
  status: string;

  @Column({ name: 'submitted_at', type: 'timestamp with time zone', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'decision_at', type: 'timestamp with time zone', nullable: true })
  decisionAt: Date | null;

  @Column({ name: 'authorization_number', length: 100, nullable: true })
  authorizationNumber: string | null;

  @Column({ name: 'authorized_units', type: 'integer', nullable: true })
  authorizedUnits: number | null;

  @Column({ name: 'authorized_from', type: 'date', nullable: true })
  authorizedFrom: Date | null;

  @Column({ name: 'authorized_to', type: 'date', nullable: true })
  authorizedTo: Date | null;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason: string | null;

  @Column({ name: 'appeal_deadline', type: 'date', nullable: true })
  appealDeadline: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

