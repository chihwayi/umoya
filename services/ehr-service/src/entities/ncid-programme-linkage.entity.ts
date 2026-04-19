import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ncid_programme_linkages' })
@Index(['patientId'])
@Index(['programme'])
export class NcidProgrammeLinkage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'programme' })
  programme: string;

  @Column({ name: 'programme_number', nullable: true })
  programmeNumber: string | null;

  @Column({ name: 'enrolled_at', type: 'date', nullable: true })
  enrolledAt: string | null;

  @Column({ name: 'discharged_at', type: 'date', nullable: true })
  dischargedAt: string | null;

  @Column({ name: 'active', default: true })
  active: boolean;

  @Column({ name: 'facility_enrolled', nullable: true })
  facilityEnrolled: string | null;

  @Column({ name: 'shared_to_national', default: false })
  sharedToNational: boolean;

  @Column({ name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
