import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('burn_assessments')
export class BurnAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ type: 'text', nullable: true }) mechanism: string;
  @Column({ name: 'estimated_tbsa', type: 'numeric', precision: 5, scale: 2, nullable: true }) estimatedTbsa: number;
  @Column({ name: 'burn_depth', type: 'jsonb', default: '{}' }) burnDepth: any;
  @Column({ name: 'lund_browder_chart', type: 'jsonb', default: '{}' }) lundBrowderChart: any;
  @Column({ name: 'fluid_resuscitation', type: 'jsonb', default: '{}' }) fluidResuscitation: any;
  @Column({ name: 'escharotomy_required', type: 'boolean', default: false }) escharotomyRequired: boolean;
  @Column({ name: 'inhalation_injury', type: 'boolean', default: false }) inhalationInjury: boolean;
  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) weightKg: number;
  @Column({ name: 'parkland_total_ml', type: 'numeric', precision: 10, scale: 2, nullable: true }) parklandTotalMl: number;
  @Column({ name: 'first_8h_ml', type: 'numeric', precision: 10, scale: 2, nullable: true }) first8hMl: number;
  @Column({ name: 'next_16h_ml', type: 'numeric', precision: 10, scale: 2, nullable: true }) next16hMl: number;
  @Column({ name: 'referral_burns_unit', type: 'boolean', default: false }) referralBurnsUnit: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
