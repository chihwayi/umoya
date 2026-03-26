import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('spirometry_results')
export class SpirometryResult {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'performed_by', type: 'uuid' }) performedBy: string;
  @Column({ name: 'test_date', type: 'timestamptz' }) testDate: Date;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) fvc: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) fev1: number;
  @Column({ name: 'fev1_fvc_ratio', type: 'numeric', precision: 5, scale: 3, nullable: true }) fev1FvcRatio: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) fef2575: number;
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true }) pef: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) tlc: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) dlco: number;
  @Column({ name: 'fvc_percent_predicted', type: 'numeric', precision: 5, scale: 1, nullable: true }) fvcPercentPredicted: number;
  @Column({ name: 'fev1_percent_predicted', type: 'numeric', precision: 5, scale: 1, nullable: true }) fev1PercentPredicted: number;
  @Column({ type: 'text' }) interpretation: string;
  @Column({ name: 'gold_stage', type: 'smallint', nullable: true }) goldStage: number;
  @Column({ name: 'pre_post_bronchodilator', type: 'boolean', default: false }) prePostBronchodilator: boolean;
  @Column({ name: 'reversibility_percent', type: 'numeric', precision: 5, scale: 1, nullable: true }) reversibilityPercent: number;
  @Column({ type: 'text', nullable: true }) quality: string;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'dlco_percent_predicted', type: 'numeric', precision: 5, scale: 2, nullable: true })
  dlcoPercentPredicted?: number;

  @Column({ name: 'fev1_l', type: 'numeric', precision: 5, scale: 3, nullable: true })
  fev1L?: number;

  @Column({ name: 'fvc_l', type: 'numeric', precision: 5, scale: 3, nullable: true })
  fvcL?: number;

  @Column({ name: 'post_bronchodilator_fev1', type: 'numeric', precision: 5, scale: 3, nullable: true })
  postBronchodilatorFev1?: number;

  @Column({ name: 'reversibility_test', type: 'boolean', nullable: true, default: false })
  reversibilityTest: boolean = false;

  @Column({ name: 'tlc_l', type: 'numeric', precision: 5, scale: 3, nullable: true })
  tlcL?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
