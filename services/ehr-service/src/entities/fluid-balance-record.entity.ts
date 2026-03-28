import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fluid_balance_records')
export class FluidBalanceRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'intake_oral_ml', type: 'int', default: 0 }) intakeOralMl: number;
  @Column({ name: 'intake_iv_ml', type: 'int', default: 0 }) intakeIvMl: number;
  @Column({ name: 'intake_ngt_ml', type: 'int', default: 0 }) intakeNgtMl: number;
  @Column({ name: 'intake_other_ml', type: 'int', default: 0 }) intakeOtherMl: number;
  @Column({ name: 'output_urine_ml', type: 'int', default: 0 }) outputUrineMl: number;
  @Column({ name: 'output_drain_ml', type: 'int', default: 0 }) outputDrainMl: number;
  @Column({ name: 'output_stoma_ml', type: 'int', default: 0 }) outputStomaMl: number;
  @Column({ name: 'output_other_ml', type: 'int', default: 0 }) outputOtherMl: number;
  @Column({ name: 'insensible_loss_ml', type: 'int', default: 0 }) insensibleLossMl: number;
  @Column({ name: 'net_balance_ml', type: 'int', nullable: true }) netBalanceMl: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
