import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('family_planning_enrollments')
export class FamilyPlanningEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'enrolled_by', type: 'uuid' })
  enrolledBy: string;

  @Column({ name: 'enrolled_at', type: 'date' })
  enrolledAt: string;

  @Column({ length: 30 })
  method: string;

  @Column({ name: 'method_detail', length: 100, nullable: true })
  methodDetail: string | null;

  @Column({ name: 'mec_category', type: 'int', nullable: true })
  mecCategory: number | null;

  @Column({ name: 'insertion_date', type: 'date', nullable: true })
  insertionDate: string | null;

  @Column({ name: 'removal_date', type: 'date', nullable: true })
  removalDate: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'next_visit_date', type: 'date', nullable: true })
  nextVisitDate: string | null;

  @Column({ length: 20, default: 'active' })
  status: string;

  @Column({ name: 'discontinuation_reason', type: 'text', nullable: true })
  discontinuationReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
