import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('malaria_tests')
export class MalariaTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'malaria_case_id', type: 'uuid' })
  malariaCaseId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'test_date', type: 'timestamptz', default: () => 'now()' })
  testDate: Date;

  @Column({ name: 'test_type', type: 'text' })
  testType: string;

  @Column({ type: 'text' })
  result: string;

  @Column({ type: 'text', nullable: true })
  species: string | null;

  @Column({ name: 'parasite_density', type: 'numeric', precision: 10, scale: 2, nullable: true })
  parasiteDensity: number | null;

  @Column({ type: 'boolean', default: false })
  gametocytes: boolean;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy: string | null;

  @Column({ name: 'lab_reference', type: 'text', nullable: true })
  labReference: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
