import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('malaria_surveillance_reports')
export class MalariaSurveillanceReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_week', type: 'int' })
  reportWeek: number;

  @Column({ name: 'report_year', type: 'int' })
  reportYear: number;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string | null;

  @Column({ name: 'total_tested', type: 'int', default: 0 })
  totalTested: number;

  @Column({ name: 'total_positive', type: 'int', default: 0 })
  totalPositive: number;

  @Column({ name: 'falciparum_cases', type: 'int', default: 0 })
  falciparumCases: number;

  @Column({ name: 'vivax_cases', type: 'int', default: 0 })
  vivaxCases: number;

  @Column({ name: 'severe_cases', type: 'int', default: 0 })
  severeCases: number;

  @Column({ type: 'int', default: 0 })
  deaths: number;

  @Column({ name: 'act_courses_used', type: 'int', default: 0 })
  actCoursesUsed: number;

  @Column({ name: 'irs_households', type: 'int', default: 0 })
  irsHouseholds: number;

  @Column({ name: 'itn_distributed', type: 'int', default: 0 })
  itnDistributed: number;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'dhis2_synced', type: 'boolean', default: false })
  dhis2Synced: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
