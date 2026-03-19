import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ntd_cases')
export class NtdCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ type: 'text' }) disease: string; // schistosomiasis|soil_transmitted_helminth|lymphatic_filariasis|trachoma|leprosy
  @Column({ type: 'text', nullable: true }) species: string;
  @Column({ name: 'acquisition_route', type: 'text', nullable: true }) acquisitionRoute: string;
  @Column({ name: 'presenting_manifestations', type: 'text', array: true, nullable: true }) presentingManifestations: string[];
  @Column({ name: 'stool_urine_result', type: 'text', nullable: true }) stoolUrineResult: string;
  @Column({ type: 'text', nullable: true }) treatment: string;
  @Column({ name: 'mass_chemoprophylaxis_campaign', type: 'boolean', default: false }) massChemoprophylaxisCampaign: boolean;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true }) diagnosisDate: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
