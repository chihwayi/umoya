import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_sessions')
export class PostVisitSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 100, nullable: true })
  tenantId: string | null;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'consultation_id', type: 'uuid', nullable: true })
  consultationId: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: 'captured',
  })
  status:
    | 'captured'
    | 'processing'
    | 'draft_ready'
    | 'doctor_reviewed'
    | 'published'
    | 'closed';

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 20,
    default: 'in_person',
  })
  sourceType: 'in_person' | 'telemedicine' | 'hybrid';

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  @Column({ name: 'started_at', type: 'timestamp with time zone', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'published_at', type: 'timestamp with time zone', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'safety_level', type: 'varchar', length: 20, nullable: true })
  safetyLevel: string | null;

  @Column({ name: 'risk_flags', type: 'jsonb', default: () => "'{}'::jsonb" })
  riskFlags: Record<string, any>;

  @Column({ name: 'meta', type: 'jsonb', default: () => "'{}'::jsonb" })
  meta: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
