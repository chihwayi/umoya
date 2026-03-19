import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('malaria_contact_tracing')
export class MalariaContactTracing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'malaria_case_id', type: 'uuid' })
  malariaCaseId: string;

  @Column({ name: 'contact_name', type: 'text' })
  contactName: string;

  @Column({ type: 'text', nullable: true })
  relationship: string | null;

  @Column({ name: 'age_years', type: 'int', nullable: true })
  ageYears: number | null;

  @Column({ name: 'screened_date', type: 'date', nullable: true })
  screenedDate: string | null;

  @Column({ name: 'rdt_result', type: 'text', nullable: true })
  rdtResult: string | null;

  @Column({ type: 'boolean', default: false })
  treated: boolean;

  @Column({ name: 'irs_applied', type: 'boolean', default: false })
  irsApplied: boolean;

  @Column({ name: 'itn_provided', type: 'boolean', default: false })
  itnProvided: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
