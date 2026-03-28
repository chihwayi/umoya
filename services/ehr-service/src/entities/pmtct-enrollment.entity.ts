import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pmtct_enrollments')
export class PmtctEnrollment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string; // mother
  @Column({ name: 'gestational_age_at_enrollment', type: 'smallint', nullable: true }) gestationalAgeAtEnrollment: number;
  @Column({ name: 'hiv_status_at_booking', type: 'text' }) hivStatusAtBooking: string; // positive|negative|unknown
  @Column({ name: 'art_started', type: 'boolean', default: false }) artStarted: boolean;
  @Column({ name: 'art_regimen', type: 'text', nullable: true }) artRegimen: string;
  @Column({ name: 'viral_load_at_booking', type: 'numeric', nullable: true }) viralLoadAtBooking: number;
  @Column({ name: 'viral_load_at_delivery', type: 'numeric', nullable: true }) viralLoadAtDelivery: number;
  @Column({ name: 'delivery_mode', type: 'text', nullable: true }) deliveryMode: string; // SVD|LSCS|instrumental
  @Column({ name: 'infant_nvp_provided', type: 'boolean', default: false }) infantNvpProvided: boolean;
  @Column({ name: 'enrollment_date', type: 'date' }) enrollmentDate: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
