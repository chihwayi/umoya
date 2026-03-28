import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';
import { User } from './user.entity';

@Entity('tb_treatment_episodes')
export class TbTreatmentEpisode {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  /** e.g. 2HRZE/4HR, 2HRZES/1HRZE/5HRE, Bdq-Lzd-Cfz-Z */
  @Column({ name: 'regimen_code', length: 30 }) regimenCode: string;
  @Column({ name: 'regimen_label', length: 100, nullable: true }) regimenLabel?: string;
  /** intensive | continuation | completed */
  @Column({ length: 20, default: 'intensive' }) phase: string = 'intensive';

  @Column({ name: 'start_date', type: 'date' }) startDate: Date;
  @Column({ name: 'expected_end', type: 'date', nullable: true }) expectedEnd?: Date;
  @Column({ name: 'actual_end', type: 'date', nullable: true }) actualEnd?: Date;
  @Column({ name: 'dot_required', type: 'boolean', default: true }) dotRequired: boolean;

  @Column({ length: 30, nullable: true }) outcome?: string;
  @Column({ name: 'outcome_date', type: 'date', nullable: true }) outcomeDate?: Date;

  @Column({ name: 'prescribed_by', type: 'uuid', nullable: true }) prescribedById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prescribed_by' }) prescribedBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
