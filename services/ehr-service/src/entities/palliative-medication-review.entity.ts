import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('palliative_medication_reviews')
export class PalliativeMedicationReview {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'reviewed_by', type: 'uuid' }) reviewedBy: string;
  @Column({ name: 'review_date', type: 'timestamptz' }) reviewDate: Date;
  @Column({ name: 'opioid_equivalence_mg_oral', type: 'numeric', precision: 8, scale: 2, nullable: true }) opioidEquivalenceMgOral: number;
  @Column({ name: 'syringe_driver_contents', type: 'jsonb', default: '[]' }) syringeDriverContents: any;
  @Column({ name: 'prn_medications', type: 'jsonb', default: '[]' }) prnMedications: any;
  @Column({ name: 'discontinued_medications', type: 'jsonb', default: '[]' }) discontinuedMedications: any;
  @Column({ name: 'route_of_administration', type: 'text', nullable: true }) routeOfAdministration: string;
  @Column({ name: 'bowel_care_plan', type: 'text', nullable: true }) bowelCarePlan: string;
  @Column({ name: 'anticipatory_medications', type: 'jsonb', default: '[]' }) anticipatoryMedications: any;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
