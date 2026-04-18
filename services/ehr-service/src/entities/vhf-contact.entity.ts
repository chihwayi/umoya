import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VhfCase } from './vhf-case.entity';

@Entity('vhf_contacts')
export class VhfContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @ManyToOne(() => VhfCase, (vhfCase) => vhfCase.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case?: VhfCase;

  @Column({ name: 'contact_name', type: 'text' })
  contactName: string;

  @Column({ name: 'contact_phone', type: 'text', nullable: true })
  contactPhone: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  contactAddress: string | null;

  @Column({ name: 'contact_type', type: 'text' })
  contactType: string;

  @Column({ type: 'text', nullable: true })
  relationship: string | null;

  @Column({ name: 'first_exposure_date', type: 'date' })
  firstExposureDate: string;

  @Column({ name: 'last_exposure_date', type: 'date' })
  lastExposureDate: string;

  @Column({ name: 'exposure_nature', type: 'text', nullable: true })
  exposureNature: string | null;

  @Column({ name: 'monitoring_start_date', type: 'date' })
  monitoringStartDate: string;

  @Column({ name: 'monitoring_end_date', type: 'date' })
  monitoringEndDate: string;

  @Column({ name: 'daily_symptoms', type: 'jsonb', default: [] })
  dailySymptoms: Record<string, any>[];

  @Column({ type: 'text', default: 'under_monitoring' })
  status: string;

  @Column({ name: 'became_case_id', type: 'uuid', nullable: true })
  becameCaseId: string | null;

  @Column({ name: 'assigned_chw_id', type: 'uuid', nullable: true })
  assignedChwId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
