import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('epilepsy_register')
export class EpilepsyRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'enrolled_by', type: 'uuid' }) enrolledBy: string;
  @Column({ name: 'enrolled_at', type: 'date' }) enrolledAt: string;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true }) diagnosisDate: string | null;
  @Column({ name: 'ilae_seizure_type', type: 'text', nullable: true }) ilaeSeizureType: string | null;
  @Column({ name: 'ilae_syndrome', type: 'text', nullable: true }) ilaeSyndrome: string | null;
  @Column({ type: 'text', nullable: true }) etiology: string | null;
  @Column({ name: 'etiology_detail', type: 'text', nullable: true }) etiologyDetail: string | null;
  @Column({ name: 'icd11_code', type: 'text', nullable: true }) icd11Code: string | null;
  @Column({ name: 'seizure_freedom_since', type: 'date', nullable: true }) seizureFreedomSince: string | null;
  @Column({ name: 'last_seizure_date', type: 'date', nullable: true }) lastSeizureDate: string | null;
  @Column({ name: 'seizure_frequency_per_month', type: 'numeric', precision: 6, scale: 2, nullable: true }) seizureFrequencyPerMonth: number | null;
  @Column({ name: 'current_status', type: 'text', default: 'active' }) currentStatus: string;
  @Column({ name: 'driving_restriction', type: 'boolean', default: false }) drivingRestriction: boolean;
  @Column({ name: 'pregnancy_risk_counselled', type: 'boolean', default: false }) pregnancyRiskCounselled: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
