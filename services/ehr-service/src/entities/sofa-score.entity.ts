import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sofa_scores')
export class SofaScore {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scored_at', type: 'timestamptz' }) scoredAt: Date;
  @Column({ name: 'pao2_fio2', type: 'numeric', precision: 6, scale: 1, nullable: true }) pao2Fio2: number;
  @Column({ type: 'smallint', nullable: true }) respiration: number;
  @Column({ type: 'numeric', precision: 7, scale: 0, nullable: true }) platelets: number;
  @Column({ type: 'smallint', nullable: true }) coagulation: number;
  @Column({ name: 'bilirubin_umol', type: 'numeric', precision: 7, scale: 1, nullable: true }) bilirubinUmol: number;
  @Column({ type: 'smallint', nullable: true }) liver: number;
  @Column({ name: 'map_mmhg', type: 'numeric', precision: 5, scale: 1, nullable: true }) mapMmhg: number;
  @Column({ type: 'text', nullable: true }) vasopressors: string;
  @Column({ type: 'smallint', nullable: true }) cardiovascular: number;
  @Column({ type: 'smallint', nullable: true }) gcs: number;
  @Column({ type: 'smallint', nullable: true }) cns: number;
  @Column({ name: 'creatinine_umol', type: 'numeric', precision: 7, scale: 1, nullable: true }) creatinineUmol: number;
  @Column({ name: 'urine_output_ml', type: 'numeric', precision: 7, scale: 1, nullable: true }) urineOutputMl: number;
  @Column({ type: 'smallint', nullable: true }) renal: number;
  @Column({ name: 'total_sofa', type: 'smallint', nullable: true }) totalSofa: number;
  @Column({ name: 'delta_sofa', type: 'smallint', nullable: true }) deltaSofa: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
