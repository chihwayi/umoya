import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('nhls_lab_results')
export class NhlsLabResult {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid', nullable: true }) patientId: string | null;
  @Column({ name: 'nhls_patient_id', length: 50, nullable: true }) nhlsPatientId: string | null;
  @Column({ name: 'nhls_lab_number', length: 50 }) nhlsLabNumber: string;
  @Column({ name: 'test_loinc_code', length: 20, nullable: true }) testLoincCode: string | null;
  @Column({ name: 'test_name', length: 100 }) testName: string;
  @Column({ name: 'result_value', type: 'text', nullable: true }) resultValue: string | null;
  @Column({ name: 'result_unit', length: 30, nullable: true }) resultUnit: string | null;
  @Column({ name: 'reference_range', length: 50, nullable: true }) referenceRange: string | null;
  @Column({ name: 'abnormal_flag', length: 5, nullable: true }) abnormalFlag: string | null;
  @Column({ name: 'result_status', length: 20, nullable: true }) resultStatus: string | null;
  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true }) collectedAt: Date | null;
  @Column({ name: 'resulted_at', type: 'timestamptz', nullable: true }) resultedAt: Date | null;
  @Column({ name: 'hl7_raw', type: 'text', nullable: true }) hl7Raw: string | null;
  @Column({ name: 'processed', default: false }) processed: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
