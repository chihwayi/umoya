import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'smartcare_patient_links' })
export class SmartcarePatientLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'local_patient_id', type: 'uuid' })
  localPatientId: string;

  @Column({ name: 'smartcare_patient_uuid', type: 'text', unique: true })
  smartcarePatientUuid: string;

  @Column({ name: 'smartcare_art_number', type: 'text', nullable: true })
  smartcareArtNumber: string | null;

  @Column({ name: 'zambia_national_id', type: 'text', nullable: true })
  zambiaNationalId: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ name: 'sync_status', type: 'text', default: 'linked' })
  syncStatus: string;

  @Column({ name: 'art_start_date', type: 'date', nullable: true })
  artStartDate: string | null;

  @Column({ name: 'last_regimen', type: 'text', nullable: true })
  lastRegimen: string | null;

  @Column({ name: 'last_cd4', type: 'int', nullable: true })
  lastCd4: number | null;

  @Column({ name: 'last_vl', type: 'decimal', precision: 12, scale: 2, nullable: true })
  lastVl: number | null;

  @Column({ name: 'last_vl_date', type: 'date', nullable: true })
  lastVlDate: string | null;

  @Column({ name: 'import_error', type: 'text', nullable: true })
  importError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
