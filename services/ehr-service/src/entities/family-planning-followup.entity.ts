import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('family_planning_followups')
export class FamilyPlanningFollowup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'conducted_by', type: 'uuid', nullable: true })
  conductedBy: string | null;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate: string;

  @Column({ default: true })
  continuing: boolean;

  @Column({ name: 'side_effects', type: 'text', array: true, nullable: true })
  sideEffects: string[] | null;

  @Column({ name: 'side_effect_severity', length: 10, nullable: true })
  sideEffectSeverity: string | null;

  @Column({ name: 'method_change', default: false })
  methodChange: boolean;

  @Column({ name: 'new_method', length: 30, nullable: true })
  newMethod: string | null;

  @Column({ name: 'counselling_given', default: false })
  counsellingGiven: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'next_visit_date', type: 'date', nullable: true })
  nextVisitDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
