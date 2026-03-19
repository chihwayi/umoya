import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('symptom_burden_scores')
export class SymptomBurdenScore {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ type: 'smallint', default: 0 }) pain: number;
  @Column({ type: 'smallint', default: 0 }) fatigue: number;
  @Column({ type: 'smallint', default: 0 }) nausea: number;
  @Column({ type: 'smallint', default: 0 }) depression: number;
  @Column({ type: 'smallint', default: 0 }) anxiety: number;
  @Column({ type: 'smallint', default: 0 }) drowsiness: number;
  @Column({ type: 'smallint', default: 0 }) appetite: number;
  @Column({ type: 'smallint', default: 0 }) wellbeing: number;
  @Column({ name: 'shortness_of_breath', type: 'smallint', default: 0 }) shortnessOfBreath: number;
  @Column({ name: 'esas_total', type: 'smallint', nullable: true }) esasTotal: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
