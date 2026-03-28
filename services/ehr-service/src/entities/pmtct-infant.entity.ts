import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pmtct_infants')
export class PmtctInfant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'mother_patient_id', type: 'uuid' }) motherPatientId: string;
  @Column({ name: 'infant_patient_id', type: 'uuid', nullable: true }) infantPatientId: string;
  @Column({ name: 'birth_date', type: 'date' }) birthDate: string;
  @Column({ name: 'birth_weight_kg', type: 'numeric', nullable: true }) birthWeightKg: number;
  @Column({ name: 'hiv_test_at_6weeks', type: 'text', nullable: true }) hivTestAt6weeks: string; // done|pending|not_done
  @Column({ name: 'dbs_result_6weeks', type: 'text', nullable: true }) dbsResult6weeks: string; // positive|negative|indeterminate
  @Column({ name: 'hiv_test_18months', type: 'text', nullable: true }) hivTest18months: string;
  @Column({ name: 'final_hiv_status', type: 'text', nullable: true }) finalHivStatus: string; // positive|negative|unknown
  @Column({ name: 'breastfeeding_status', type: 'text', nullable: true }) breastfeedingStatus: string; // exclusive_bf|mixed|formula|stopped
  @Column({ name: 'cotrimoxazole_started', type: 'boolean', default: false }) cotrimoxazoleStarted: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
