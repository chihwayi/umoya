import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pressure_injury_assessments')
export class PressureInjuryAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'assessed_by', type: 'uuid' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'timestamptz', default: () => 'now()' })
  assessmentDate: Date;

  @Column({ name: 'braden_score', type: 'int', nullable: true })
  bradenScore: number | null;

  @Column({ name: 'existing_injuries', type: 'jsonb', default: [] })
  existingInjuries: any[];

  @Column({ name: 'prevention_protocol', type: 'text', nullable: true })
  preventionProtocol: string | null;

  @Column({ name: 'repositioning_schedule', type: 'text', nullable: true })
  repositioningSchedule: string | null;

  @Column({ name: 'special_surface_required', type: 'boolean', default: false })
  specialSurfaceRequired: boolean;

  @Column({ name: 'skin_condition', type: 'text', nullable: true })
  skinCondition: string | null;

  @Column({ name: 'moisture_management', type: 'text', nullable: true })
  moistureManagement: string | null;

  @Column({ name: 'nutritional_support', type: 'text', nullable: true })
  nutritionalSupport: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
