import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('art_cohorts')
export class ArtCohort {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'cohort_start_date', type: 'date' }) cohortStartDate: string;
  @Column({ name: 'cohort_size', type: 'int' }) cohortSize: number;
  @Column({ name: 'alive_on_art_12m', type: 'int', nullable: true }) aliveOnArt12m: number;
  @Column({ name: 'lost_to_followup_12m', type: 'int', nullable: true }) lostToFollowup12m: number;
  @Column({ name: 'died_12m', type: 'int', nullable: true }) died12m: number;
  @Column({ name: 'transferred_out_12m', type: 'int', nullable: true }) transferredOut12m: number;
  @Column({ name: 'retention_rate', type: 'numeric', nullable: true }) retentionRate: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
