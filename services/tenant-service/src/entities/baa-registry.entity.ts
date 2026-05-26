import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type BaaVendorType =
  | 'sms_provider'
  | 'video_provider'
  | 'payment_gateway'
  | 'cloud_storage'
  | 'ai_provider'
  | 'lab_integration'
  | 'other';

export type BaaStatus = 'pending' | 'signed' | 'expired' | 'not_required';

@Entity('baa_registry')
export class BaaRegistryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_name', length: 200 })
  vendorName: string;

  @Index()
  @Column({ name: 'vendor_type', length: 60 })
  vendorType: BaaVendorType;

  @Column({ name: 'service_url', length: 500, nullable: true })
  serviceUrl: string | null;

  @Column({ name: 'contact_email', length: 200, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone: string | null;

  @Index()
  @Column({ name: 'baa_status', length: 30, default: 'pending' })
  baaStatus: BaaStatus;

  @Column({ name: 'baa_signed_date', type: 'date', nullable: true })
  baaSignedDate: string | null;

  @Column({ name: 'baa_expiry_date', type: 'date', nullable: true })
  baaExpiryDate: string | null;

  @Column({ name: 'baa_document_url', length: 1000, nullable: true })
  baaDocumentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
