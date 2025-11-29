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

@Entity({ name: 'clinical_note_templates' })
export class ClinicalNoteTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  category: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  variables: Record<string, any>[];

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

