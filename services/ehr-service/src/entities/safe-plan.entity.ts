import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('safe_plans')
export class SafePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'warning_signs', type: 'jsonb', default: [] })
  warningSigns: any[];

  @Column({ name: 'internal_coping', type: 'jsonb', default: [] })
  internalCoping: any[];

  @Column({ name: 'social_distractions', type: 'jsonb', default: [] })
  socialDistractions: any[];

  @Column({ name: 'support_contacts', type: 'jsonb', default: [] })
  supportContacts: any[];

  @Column({ name: 'professional_contacts', type: 'jsonb', default: [] })
  professionalContacts: any[];

  @Column({ name: 'means_restriction', type: 'text', nullable: true })
  meansRestriction: string | null;

  @Column({ name: 'reason_to_live', type: 'text', nullable: true })
  reasonToLive: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
