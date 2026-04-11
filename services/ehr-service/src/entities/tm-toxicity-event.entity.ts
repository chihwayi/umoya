import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tm_toxicity_events')
export class TmToxicityEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'tm_remedy_id', type: 'uuid', nullable: true }) tmRemedyId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' }) recordedAt: Date;
  @Column({ name: 'organ_system', length: 30 }) organSystem: string;
  @Column({ type: 'text' }) presentation: string;
  @Column({ name: 'lab_markers', type: 'jsonb', nullable: true }) labMarkers: Record<string, number> | null;
  @Column({ name: 'causality_assessment', length: 20, nullable: true }) causalityAssessment: string | null;
  @Column({ length: 30, nullable: true }) outcome: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
