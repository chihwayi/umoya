import { CreateDateColumn, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type DemoAccessRequestStatus =
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'provisioned'
  | 'rejected';

@Entity('demo_access_requests')
export class DemoAccessRequest {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'clinic_name' })
  clinicName: string;

  @Column({ name: 'work_email' })
  workEmail: string;

  @Column()
  phone: string;

  @Column({ name: 'role_title', nullable: true })
  roleTitle: string | null;

  @Column({ nullable: true })
  specialization: string | null;

  @Column({ name: 'current_system', nullable: true })
  currentSystem: string | null;

  @Column({ name: 'interest_summary', type: 'text' })
  interestSummary: string;

  @Column({ name: 'interest_areas', type: 'simple-json', nullable: false })
  interestAreas: string[];

  @Column({ name: 'preferred_contact_method', default: 'email' })
  preferredContactMethod: string;

  @Column({ default: 'new' })
  status: DemoAccessRequestStatus;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ name: 'assigned_tenant_id', nullable: true })
  assignedTenantId: string | null;

  @Column({ name: 'assigned_subdomain', nullable: true })
  assignedSubdomain: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
