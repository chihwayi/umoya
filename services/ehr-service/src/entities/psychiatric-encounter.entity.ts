import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('psychiatric_encounters')
export class PsychiatricEncounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'encounter_date', type: 'timestamptz', default: () => 'now()' })
  encounterDate: Date;

  @Column({ name: 'encounter_type', type: 'text' })
  encounterType: string;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ name: 'mental_status', type: 'jsonb', default: {} })
  mentalStatus: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  diagnoses: any[];

  @Column({ name: 'treatment_plan', type: 'text', nullable: true })
  treatmentPlan: string | null;

  @Column({ name: 'risk_assessment', type: 'jsonb', nullable: true })
  riskAssessment: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  disposition: string | null;

  @Column({ name: 'next_appointment', type: 'date', nullable: true })
  nextAppointment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
