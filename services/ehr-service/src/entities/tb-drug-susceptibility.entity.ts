import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';

@Entity('tb_drug_susceptibilities')
export class TbDrugSusceptibility {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'specimen_date', type: 'date' }) specimenDate: Date;
  @Column({ name: 'reported_date', type: 'date', nullable: true }) reportedDate?: Date;
  @Column({ name: 'laboratory_id', length: 50, nullable: true }) laboratoryId?: string;

  @Column({ length: 20, nullable: true }) isoniazid?: string;
  @Column({ length: 20, nullable: true }) rifampicin?: string;
  @Column({ length: 20, nullable: true }) ethambutol?: string;
  @Column({ length: 20, nullable: true }) pyrazinamide?: string;
  @Column({ length: 20, nullable: true }) streptomycin?: string;
  @Column({ length: 20, nullable: true }) fluoroquinolone?: string;
  @Column({ length: 20, nullable: true }) kanamycin?: string;

  /** e.g. MDR | XDR | mono | poly | susceptible */
  @Column({ name: 'resistance_pattern', length: 30, nullable: true }) resistancePattern?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
