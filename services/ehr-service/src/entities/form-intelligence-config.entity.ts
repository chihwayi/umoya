import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('form_intelligence_configs')
export class FormIntelligenceConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'form_name', type: 'text' }) formName: string; // encounter|vitals|prescription|lab_order
  @Column({ name: 'visibility_rules', type: 'jsonb', default: '[]' }) visibilityRules: any[]; // [{condition, field, action: show|hide}]
  @Column({ name: 'default_rules', type: 'jsonb', default: '[]' }) defaultRules: any[]; // [{condition, field, value, confidence}]
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'version', type: 'int', default: 1 }) version: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
