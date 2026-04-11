import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('bp_readings')
export class BpReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'htn_register_id', type: 'uuid', nullable: true })
  htnRegisterId: string | null;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' })
  recordedAt: Date;

  @Column({ name: 'sbp', type: 'int' })
  sbp: number;

  @Column({ name: 'dbp', type: 'int' })
  dbp: number;

  @Column({ name: 'pulse', type: 'int', nullable: true })
  pulse: number | null;

  /** left | right */
  @Column({ length: 10, default: 'left' })
  arm: string;

  /** sitting | standing | supine */
  @Column({ length: 15, default: 'sitting' })
  position: string;

  /** Derived classification: normal | elevated | stage1 | stage2 | hypertensive_crisis */
  @Column({ length: 25, nullable: true })
  classification: string | null;

  /** Context: clinic | home | ambulatory */
  @Column({ length: 20, default: 'clinic' })
  context: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
