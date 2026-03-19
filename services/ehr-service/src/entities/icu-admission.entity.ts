import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('icu_admissions')
export class IcuAdmission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'admission_id', type: 'uuid', nullable: true }) admissionId: string;
  @Column({ name: 'icu_admission_date', type: 'timestamptz' }) icuAdmissionDate: Date;
  @Column({ name: 'icu_discharge_date', type: 'timestamptz', nullable: true }) icuDischargeDate: Date;
  @Column({ name: 'admission_source', type: 'text', nullable: true }) admissionSource: string;
  @Column({ name: 'primary_diagnosis', type: 'text', nullable: true }) primaryDiagnosis: string;
  @Column({ name: 'apache_ii_score', type: 'smallint', nullable: true }) apacheIiScore: number;
  @Column({ name: 'sofa_admission', type: 'smallint', nullable: true }) sofaAdmission: number;
  @Column({ name: 'icu_discharge_reason', type: 'text', nullable: true }) icuDischargeReason: string;
  @Column({ name: 'mortality_predicted', type: 'numeric', precision: 5, scale: 2, nullable: true }) mortalityPredicted: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
