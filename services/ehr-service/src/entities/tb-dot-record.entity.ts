import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';
import { TbTreatmentEpisode } from './tb-treatment-episode.entity';
import { User } from './user.entity';

@Entity('tb_dot_records')
export class TbDotRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'episode_id', type: 'uuid', nullable: true }) episodeId?: string;
  @ManyToOne(() => TbTreatmentEpisode, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'episode_id' }) episode?: TbTreatmentEpisode;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'dot_date', type: 'date' }) dotDate: Date;
  @Column({ type: 'boolean' }) observed: boolean;

  @Column({ name: 'dot_worker_id', type: 'uuid', nullable: true }) dotWorkerId?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dot_worker_id' }) dotWorker?: User;

  /** in_person | video | community_worker | self_administered */
  @Column({ name: 'dot_method', length: 30, default: 'in_person' }) dotMethod: string = 'in_person';
  @Column({ name: 'doses_taken', type: 'int', default: 1 }) dosesTaken: number;
  @Column({ name: 'reason_missed', type: 'text', nullable: true }) reasonMissed?: string;
  @Column({ name: 'side_effects', type: 'text', nullable: true }) sideEffects?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' }) recordedAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
