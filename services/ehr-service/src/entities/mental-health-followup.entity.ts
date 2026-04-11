import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mental_health_followups')
export class MentalHealthFollowup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'care_plan_id', type: 'uuid', nullable: true })
  carePlanId: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'followup_date', type: 'date' })
  followupDate: string;

  @Column({ name: 'conducted_by', type: 'uuid', nullable: true })
  conductedBy: string | null;

  @Column({ length: 20, nullable: true })
  status: string | null;

  @Column({ name: 'symptom_change', length: 20, nullable: true })
  symptomChange: string | null;

  @Column({ name: 'medication_adherent', nullable: true })
  medicationAdherent: boolean | null;

  @Column({ name: 'safety_concern', default: false })
  safetyConcern: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'next_followup_date', type: 'date', nullable: true })
  nextFollowupDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
