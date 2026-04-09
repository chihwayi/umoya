import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('contact_traces')
export class ContactTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'index_case_id', type: 'uuid', nullable: true })
  indexCaseId: string | null;

  @Column({ name: 'contact_patient_id', type: 'uuid', nullable: true })
  contactPatientId: string | null;

  @Column({ name: 'contact_name', length: 200, nullable: true })
  contactName: string | null;

  @Column({ name: 'contact_phone', length: 30, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'contact_relationship', length: 50, nullable: true })
  contactRelationship: string | null;

  @Column({ name: 'exposure_date', type: 'date', nullable: true })
  exposureDate: string | null;

  @Column({ name: 'exposure_type', length: 50, nullable: true })
  exposureType: string | null;

  @Column({ name: 'follow_up_status', default: 'pending' })
  followUpStatus: string; // pending | in_progress | completed | lost

  @Column({ name: 'follow_up_due_date', type: 'date', nullable: true })
  followUpDueDate: string | null;

  @Column({ name: 'last_follow_up_date', type: 'date', nullable: true })
  lastFollowUpDate: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
