import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('physio_referral')
export class PhysioReferral {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'referred_by', type: 'uuid' }) referredBy: string;
  @Column({ name: 'referral_date', type: 'date' }) referralDate: string;
  @Column({ name: 'source_specialty', length: 50 }) sourceSpecialty: string; // orthopedics|neurology|cardiology|oncology|maternity|general
  @Column({ name: 'referral_reason', length: 200 }) referralReason: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'rehab_type', length: 30 }) rehabType: string; // physiotherapy|occupational_therapy|speech_language|cardiac_rehab|pulmonary_rehab|vestibular
  @Column({ name: 'urgency', length: 15, default: 'routine' }) urgency: string; // urgent|semi_urgent|routine
  @Column({ name: 'goals', type: 'text', nullable: true }) goals: string | null;
  @Column({ name: 'functional_baseline', type: 'text', nullable: true }) functionalBaseline: string | null;
  @Column({ name: 'contraindications', type: 'text', nullable: true }) contraindications: string | null;
  @Column({ name: 'status', length: 20, default: 'pending' }) status: string; // pending|active|completed|cancelled
  @Column({ name: 'accepted_date', type: 'date', nullable: true }) acceptedDate: string | null;
  @Column({ name: 'discharge_date', type: 'date', nullable: true }) dischargeDate: string | null;
  @Column({ name: 'sessions_planned', type: 'integer', nullable: true }) sessionsPlanned: number | null;
  @Column({ name: 'sessions_attended', type: 'integer', default: 0 }) sessionsAttended: number;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
