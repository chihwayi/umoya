import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';

@Entity('tb_contact_investigations')
export class TbContactInvestigation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'contact_name', length: 150 }) contactName: string;
  @Column({ length: 50, nullable: true }) relationship?: string;
  @Column({ type: 'int', nullable: true }) age?: number;
  @Column({ length: 10, nullable: true }) gender?: string;

  @Column({ name: 'is_registered_patient', type: 'boolean', default: false }) isRegisteredPatient: boolean;
  @Column({ name: 'contact_patient_id', type: 'uuid', nullable: true }) contactPatientId?: string;
  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contact_patient_id' }) contactPatient?: Patient;

  @Column({ name: 'screening_date', type: 'date', nullable: true }) screeningDate?: Date;
  @Column({ name: 'tst_result', length: 20, nullable: true }) tstResult?: string;
  @Column({ name: 'igra_result', length: 20, nullable: true }) igraResult?: string;
  @Column({ name: 'cxr_result', type: 'text', nullable: true }) cxrResult?: string;

  /** positive | negative | unknown | pending */
  @Column({ name: 'ltbi_status', length: 20, default: 'unknown' }) ltbiStatus: string = 'unknown';
  @Column({ name: 'prophylaxis_started', type: 'boolean', default: false }) prophylaxisStarted: boolean;
  @Column({ name: 'prophylaxis_regimen', length: 50, nullable: true }) prophylaxisRegimen?: string;
  @Column({ name: 'tb_disease_found', type: 'boolean', default: false }) tbDiseaseFound: boolean;
  @Column({ length: 30, nullable: true }) outcome?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
