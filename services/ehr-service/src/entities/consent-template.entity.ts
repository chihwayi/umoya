import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('consent_templates')
export class ConsentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_name', length: 255 })
  templateName: string;

  @Column({ name: 'template_code', length: 100, unique: true })
  templateCode: string;

  @Column({ name: 'consent_type', length: 50 })
  consentType: string;

  @Column({ length: 20 })
  version: string;

  @Column({ name: 'language_code', length: 10, default: 'en' })
  languageCode: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'required_fields', type: 'jsonb', default: '[]' })
  requiredFields: any[];

  @Column({ name: 'signature_requirements', type: 'jsonb' })
  signatureRequirements: {
    patient: boolean;
    guardian: boolean;
    witness: boolean;
    provider: boolean;
  };

  @Column({ name: 'validity_period_days', nullable: true })
  validityPeriodDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ length: 100, nullable: true })
  specialty: string;

  @Column({ name: 'procedure_codes', type: 'jsonb', default: '[]' })
  procedureCodes: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

