import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum PrescriptionTemplateCategory {
  ANTIBIOTIC = 'antibiotic',
  PAIN_MANAGEMENT = 'pain_management',
  HYPERTENSION = 'hypertension',
  DIABETES = 'diabetes',
  RESPIRATORY = 'respiratory',
  GASTROINTESTINAL = 'gastrointestinal',
  CARDIAC = 'cardiac',
  MENTAL_HEALTH = 'mental_health',
  PEDIATRIC = 'pediatric',
  OTHER = 'other',
}

export enum PrescriptionTemplateRoute {
  ORAL = 'oral',
  INJECTION = 'injection',
  TOPICAL = 'topical',
  INHALATION = 'inhalation',
  INTRAVENOUS = 'intravenous',
  SUBLINGUAL = 'sublingual',
  RECTAL = 'rectal',
  OTHER = 'other',
}

@Entity({ name: 'prescription_templates' })
export class PrescriptionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'enum', enum: PrescriptionTemplateCategory })
  category: PrescriptionTemplateCategory;

  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'generic_name', length: 255, nullable: true })
  genericName?: string;

  @Column({ length: 100 })
  dosage: string;

  @Column({ name: 'dosage_unit', length: 50, nullable: true })
  dosageUnit?: string;

  @Column({ length: 100 })
  frequency: string;

  @Column({ type: 'enum', enum: PrescriptionTemplateRoute, nullable: true })
  route?: PrescriptionTemplateRoute;

  @Column({ length: 100, nullable: true })
  duration?: string;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ type: 'text', nullable: true })
  indications?: string;

  @Column({ type: 'text', nullable: true })
  contraindications?: string;

  @Column({ name: 'side_effects', type: 'text', nullable: true })
  sideEffects?: string;

  @Column({ length: 100, nullable: true })
  specialty?: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

