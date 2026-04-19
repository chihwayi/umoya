import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'disa_sync_log' })
export class DisaSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'disa_patient_id', type: 'text', nullable: true })
  disaPatientId: string | null;

  @Column({ name: 'nid', type: 'text', nullable: true })
  nid: string | null;

  @Column({ name: 'sync_type', type: 'text' })
  syncType: string;

  @Column({ name: 'sync_status', type: 'text', default: 'pending' })
  syncStatus: string;

  @Column({ name: 'sample_id', type: 'text', nullable: true })
  sampleId: string | null;

  @Column({ name: 'sample_collection_date', type: 'date', nullable: true })
  sampleCollectionDate: string | null;

  @Column({ name: 'result_type', type: 'text', nullable: true })
  resultType: string | null;

  @Column({ name: 'result_value', type: 'text', nullable: true })
  resultValue: string | null;

  @Column({ name: 'result_numeric', type: 'decimal', precision: 12, scale: 2, nullable: true })
  resultNumeric: number | null;

  @Column({ name: 'result_date', type: 'date', nullable: true })
  resultDate: string | null;

  @Column({ name: 'suppressed', type: 'boolean', nullable: true })
  suppressed: boolean | null;

  @Column({ name: 'disa_facility_code', type: 'text', nullable: true })
  disaFacilityCode: string | null;

  @Column({ name: 'disa_province', type: 'text', nullable: true })
  disaProvince: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
