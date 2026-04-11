import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('malaria_episodes')
export class MalariaEpisode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'episode_date', type: 'date' }) episodeDate: string;
  @Column({ name: 'rdt_result', nullable: true }) rdtResult: string | null;
  @Column({ name: 'species_confirmed', nullable: true }) speciesConfirmed: string | null;
  @Column({ name: 'parasite_density', type: 'int', nullable: true }) parasiteDensity: number | null;
  @Column({ name: 'severity_criteria', type: 'text', array: true, nullable: true }) severityCriteria: string[] | null;
  @Column({ name: 'severity_grade', nullable: true }) severityGrade: string | null;
  @Column({ name: 'g6pd_tested', default: false }) g6pdTested: boolean;
  @Column({ name: 'g6pd_result', nullable: true }) g6pdResult: string | null;
  @Column({ name: 'primaquine_given', default: false }) primaquineGiven: boolean;
  @Column({ name: 'treatment_regimen', nullable: true }) treatmentRegimen: string | null;
  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true }) weightKg: number | null;
  @Column({ name: 'act_dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) actDoseMg: number | null;
  @Column({ name: 'iptp_dose_number', type: 'int', nullable: true }) iptpDoseNumber: number | null;
  @Column({ name: 'iptp_sp_given', default: false }) iptpSpGiven: boolean;
  @Column({ name: 'admitted', default: false }) admitted: boolean;
  @Column({ name: 'outcome', nullable: true }) outcome: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
