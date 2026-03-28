import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('community_resources')
export class CommunityResource {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text' }) category: string; // food_bank|shelter|transport|financial_assistance|mental_health|domestic_violence|employment
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ type: 'text', nullable: true }) address: string;
  @Column({ type: 'text', nullable: true }) phone: string;
  @Column({ type: 'text', nullable: true }) website: string;
  @Column({ name: 'eligibility_criteria', type: 'text', nullable: true }) eligibilityCriteria: string;
  @Column({ type: 'text', array: true, nullable: true }) languages: string[];
  @Column({ type: 'text', nullable: true }) availability: string;
  @Column({ name: 'tenant_specific', type: 'boolean', default: true }) tenantSpecific: boolean;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
