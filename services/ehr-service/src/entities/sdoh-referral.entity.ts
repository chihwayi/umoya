import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sdoh_referrals')
export class SdohReferral {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'resource_id', type: 'uuid' }) resourceId: string;
  @Column({ name: 'referral_date', type: 'date' }) referralDate: string;
  @Column({ name: 'referral_reason', type: 'text' }) referralReason: string;
  @Column({ name: 'referred_by', type: 'uuid' }) referredBy: string;
  @Column({ type: 'text', default: 'sent' }) status: string; // sent|accepted|completed|declined
  @Column({ type: 'text', nullable: true }) outcome: string;
  @Column({ name: 'follow_up_date', type: 'date', nullable: true }) followUpDate: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
