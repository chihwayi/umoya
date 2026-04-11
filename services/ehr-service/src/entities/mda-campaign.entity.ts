import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mda_campaigns')
export class MdaCampaign {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'campaign_name' }) campaignName: string;
  @Column({ name: 'disease_type' }) diseaseType: string;
  @Column({ name: 'drug_name' }) drugName: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date' }) endDate: string;
  @Column({ name: 'target_population', type: 'int', nullable: true }) targetPopulation: number | null;
  @Column({ name: 'treated_count', type: 'int', default: 0 }) treatedCount: number;
  @Column({ name: 'coverage_area', type: 'text', nullable: true }) coverageArea: string | null;
  @Column({ name: 'dhis2_dataset_uid', nullable: true }) dhis2DatasetUid: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
