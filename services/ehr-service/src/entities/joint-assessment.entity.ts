import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('joint_assessment')
export class JointAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'rheumatology_register_id', type: 'uuid', nullable: true }) rheumatologyRegisterId: string | null;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'swollen_joint_count_28', type: 'integer', nullable: true }) swollenJointCount28: number | null;
  @Column({ name: 'tender_joint_count_28', type: 'integer', nullable: true }) tenderJointCount28: number | null;
  @Column({ name: 'esr_mm_hr', type: 'numeric', precision: 5, scale: 1, nullable: true }) esrMmHr: number | null;
  @Column({ name: 'crp_mg_l', type: 'numeric', precision: 6, scale: 2, nullable: true }) crpMgL: number | null;
  @Column({ name: 'patient_global_vas', type: 'numeric', precision: 4, scale: 1, nullable: true }) patientGlobalVas: number | null; // 0–100
  @Column({ name: 'das28_esr', type: 'numeric', precision: 4, scale: 2, nullable: true }) das28Esr: number | null;
  @Column({ name: 'das28_crp', type: 'numeric', precision: 4, scale: 2, nullable: true }) das28Crp: number | null;
  @Column({ name: 'sdai_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) sdaiScore: number | null;
  @Column({ name: 'cdai_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) cdaiScore: number | null;
  @Column({ name: 'affected_joints', type: 'jsonb', nullable: true }) affectedJoints: Record<string, any> | null;
  @Column({ name: 'morning_stiffness_minutes', type: 'integer', nullable: true }) morningStiffnessMinutes: number | null;
  @Column({ name: 'functional_disability_score', type: 'numeric', precision: 4, scale: 2, nullable: true }) functionalDisabilityScore: number | null; // HAQ-DI 0-3
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
