import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chw_daily_tallies')
export class ChwDailyTally {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chw_id', type: 'uuid' })
  chwId: string;

  @Column({ name: 'tally_date', type: 'date' })
  tallyDate: string;

  @Column({ name: 'households_visited', default: 0 })
  householdsVisited: number;

  @Column({ name: 'anc_visits', default: 0 })
  ancVisits: number;

  @Column({ name: 'postnatal_visits', default: 0 })
  postnatalVisits: number;

  @Column({ name: 'sick_children_seen', default: 0 })
  sickChildrenSeen: number;

  @Column({ name: 'tb_dot_observations', default: 0 })
  tbDotObservations: number;

  @Column({ name: 'muac_screenings', default: 0 })
  muacScreenings: number;

  @Column({ name: 'sam_cases_identified', default: 0 })
  samCasesIdentified: number;

  @Column({ name: 'referrals_made', default: 0 })
  referralsMade: number;

  @Column({ name: 'immunizations_given', default: 0 })
  immunizationsGiven: number;

  @Column({ name: 'dhis2_synced', default: false })
  dhis2Synced: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
