import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('transplant_records')
export class TransplantRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'transplant_date', type: 'date' }) transplantDate: string;
  @Column({ name: 'donor_type', type: 'text' }) donorType: string;
  @Column({ name: 'cold_ischaemia_hours', type: 'numeric', precision: 5, scale: 2, nullable: true }) coldIschaemiaHours: number;
  @Column({ name: 'hla_matching', type: 'text', nullable: true }) hlaMatching: string;
  @Column({ type: 'jsonb', default: '[]' }) immunosuppression: any;
  @Column({ name: 'induction_agent', type: 'text', nullable: true }) inductionAgent: string;
  @Column({ name: 'current_egfr', type: 'numeric', precision: 6, scale: 2, nullable: true }) currentEgfr: number;
  @Column({ name: 'rejection_episodes', type: 'jsonb', default: '[]' }) rejectionEpisodes: any;
  @Column({ name: 'latest_biopsy_result', type: 'text', nullable: true }) latestBiopsyResult: string;
  @Column({ name: 'dsas_present', type: 'boolean', default: false }) dsasPresent: boolean;
  @Column({ type: 'jsonb', default: '[]' }) complications: any;
  @Column({ name: 'transplant_centre', type: 'text', nullable: true }) transplantCentre: string;  @Column({ name: 'current_immunosuppression', type: 'jsonb', nullable: true, default: [] })
  currentImmunosuppression: any = [];

  @Column({ name: 'graft_status', type: 'text', nullable: true })
  graftStatus?: string;

  @Column({ name: 'hla_mismatch', type: 'text', nullable: true })
  hlaMismatch?: string;

  @Column({ name: 'initial_function', type: 'text', nullable: true })
  initialFunction?: string;

  @Column({ name: 'latest_egfr', type: 'numeric', precision: 6, scale: 2, nullable: true })
  latestEgfr?: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  organ?: string;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
