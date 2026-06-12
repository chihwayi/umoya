import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dmard_record')
export class DmardRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'rheumatology_register_id', type: 'uuid', nullable: true }) rheumatologyRegisterId: string | null;
  @Column({ name: 'drug_name', length: 100 }) drugName: string; // methotrexate|hydroxychloroquine|sulfasalazine|leflunomide|tocilizumab|adalimumab|etanercept|rituximab
  @Column({ name: 'drug_class', length: 30 }) drugClass: string; // csDMARD|bDMARD|tsDMARD
  @Column({ name: 'dose_mg', type: 'numeric', precision: 6, scale: 2, nullable: true }) doseMg: number | null;
  @Column({ name: 'frequency', length: 30, nullable: true }) frequency: string | null;
  @Column({ name: 'route', length: 20, nullable: true }) route: string | null; // oral|sc|iv
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'stop_date', type: 'date', nullable: true }) stopDate: string | null;
  @Column({ name: 'stop_reason', length: 100, nullable: true }) stopReason: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'tb_screened_before_start', type: 'boolean', nullable: true }) tbScreenedBeforeStart: boolean | null;
  @Column({ name: 'monitoring_required', type: 'text', nullable: true }) monitoringRequired: string | null; // FBC|LFT|renal|ophthalmology
  @Column({ name: 'adverse_effects', type: 'text', nullable: true }) adverseEffects: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
