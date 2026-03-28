import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('culture_sensitivity_results')
export class CultureSensitivityResult {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'lab_order_id', type: 'uuid', nullable: true }) labOrderId: string;
  @Column({ name: 'specimen_type', type: 'text' }) specimenType: string;
  @Column({ name: 'collection_date', type: 'date' }) collectionDate: string;
  @Column({ name: 'organism_isolated', type: 'text', nullable: true }) organismIsolated: string;
  @Column({ name: 'no_growth', type: 'boolean', default: false }) noGrowth: boolean;
  @Column({ name: 'disk_diffusion_results', type: 'jsonb', default: '{}' }) diskDiffusionResults: Record<string, any>; // antibiotic → {zone_mm, interpretation: S|I|R}
  @Column({ name: 'mic_values', type: 'jsonb', default: '{}' }) micValues: Record<string, any>; // antibiotic → {mic, interpretation}
  @Column({ name: 'clsi_breakpoints_used', type: 'text', nullable: true }) clsiBreakpointsUsed: string;
  @Column({ name: 'esbl_detected', type: 'boolean', nullable: true }) esblDetected: boolean;
  @Column({ name: 'carbapenem_resistant', type: 'boolean', nullable: true }) carbapenemResistant: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
