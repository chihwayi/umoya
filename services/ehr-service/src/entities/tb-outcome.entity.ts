import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';
import { TbTreatmentEpisode } from './tb-treatment-episode.entity';
import { User } from './user.entity';

@Entity('tb_outcomes')
export class TbOutcome {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'episode_id', type: 'uuid', nullable: true }) episodeId?: string;
  @ManyToOne(() => TbTreatmentEpisode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'episode_id' }) episode?: TbTreatmentEpisode;

  /** cured | treatment_completed | treatment_failed | died | ltfu | transferred_out | not_evaluated */
  @Column({ length: 30 }) outcome: string;
  @Column({ name: 'outcome_date', type: 'date' }) outcomeDate: Date;
  @Column({ name: 'cause_of_death', length: 200, nullable: true }) causeOfDeath?: string;
  @Column({ name: 'transfer_facility', length: 100, nullable: true }) transferFacility?: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true }) recordedById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' }) recordedBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
