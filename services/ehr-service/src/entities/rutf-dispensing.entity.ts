import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('rutf_dispensing')
export class RutfDispensing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'nutrition_assessment_id', type: 'uuid', nullable: true })
  nutritionAssessmentId: string | null;

  @Column({ name: 'dispensed_date', type: 'date' })
  dispensedDate: string;

  @Column({ name: 'dispensed_by', type: 'uuid', nullable: true })
  dispensedBy: string | null;

  @Column({ name: 'product_name', length: 50 })
  productName: string;

  @Column({ name: 'sachets_dispensed', type: 'int', nullable: true })
  sachetsDispensed: number | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'dose_sachets_per_day', type: 'int', nullable: true })
  doseSachetsPerDay: number | null;

  @Column({ name: 'lot_number', length: 50, nullable: true })
  lotNumber: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'next_visit_date', type: 'date', nullable: true })
  nextVisitDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
