import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('advance_care_planning')
export class AdvanceCarePlanning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'document_type', type: 'text' })
  documentType: string;

  @Column({ name: 'document_date', type: 'date' })
  documentDate: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'document_storage_key', type: 'text', nullable: true })
  documentStorageKey: string | null;

  @Column({ name: 'witness_signed', type: 'boolean', default: false })
  witnessSigned: boolean;

  @Column({ name: 'physician_signed', type: 'boolean', default: false })
  physicianSigned: boolean;

  @Column({ name: 'patient_signed', type: 'boolean', default: false })
  patientSigned: boolean;

  @Column({ name: 'capacity_confirmed', type: 'boolean', default: false })
  capacityConfirmed: boolean;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
