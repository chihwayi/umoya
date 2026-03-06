import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_companion_threads')
export class PostVisitCompanionThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'closed';

  @Column({ name: 'message_count', type: 'integer', default: 0 })
  messageCount: number;

  @Column({ name: 'last_message_at', type: 'timestamp with time zone', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'last_patient_message_at', type: 'timestamp with time zone', nullable: true })
  lastPatientMessageAt: Date | null;

  @Column({ name: 'last_clinician_message_at', type: 'timestamp with time zone', nullable: true })
  lastClinicianMessageAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
