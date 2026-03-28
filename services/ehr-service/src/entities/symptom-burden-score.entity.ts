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
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'anxiety_score', type: 'int', nullable: true })
  anxietyScore?: number;

  @Column({ name: 'appetite_score', type: 'int', nullable: true })
  appetiteScore?: number;

  @Column({ name: 'depression_score', type: 'int', nullable: true })
  depressionScore?: number;

  @Column({ name: 'drowsiness_score', type: 'int', nullable: true })
  drowsinessScore?: number;

  @Column({ name: 'dyspnoea_score', type: 'int', nullable: true })
  dyspnoeaScore?: number;

  @Column({ name: 'nausea_score', type: 'int', nullable: true })
  nauseaScore?: number;

  @Column({ name: 'pain_score', type: 'int', nullable: true })
  painScore?: number;

  @Column({ name: 'tiredness_score', type: 'int', nullable: true })
  tirednessScore?: number;

  @Column({ name: 'wellbeing_score', type: 'int', nullable: true })
  wellbeingScore?: number;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
