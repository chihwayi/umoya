import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { TbPatient } from './tb-patient.entity';
import { User } from './user.entity';

@Entity('tb_diagnoses')
export class TbDiagnosis {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tb_patient_id', type: 'uuid' }) tbPatientId: string;
  @ManyToOne(() => TbPatient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tb_patient_id' }) tbPatient?: TbPatient;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'diagnosis_date', type: 'date', default: () => 'CURRENT_DATE' }) diagnosisDate: Date;

  /** positive | negative | scanty | not_done */
  @Column({ name: 'sputum_smear_result', length: 20, nullable: true }) sputumSmearResult?: string;
  /** mtb_detected | mtb_not_detected | mtb_detected_rif_resistant | mtb_detected_rif_indeterminate | invalid | error | not_done */
  @Column({ name: 'genexpert_result', length: 30, nullable: true }) genexpertResult?: string;
  /** positive | negative | contaminated | not_done */
  @Column({ name: 'culture_result', length: 20, nullable: true }) cultureResult?: string;
  @Column({ name: 'cxr_finding', type: 'text', nullable: true }) cxrFinding?: string;
  @Column({ name: 'anatomical_site', length: 100, nullable: true }) anatomicalSite?: string;
  @Column({ name: 'laboratory_id', length: 50, nullable: true }) laboratoryId?: string;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true }) reportedById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_by' }) reportedBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
