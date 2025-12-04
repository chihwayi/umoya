import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { SurgicalCase } from './surgical-case.entity';
import { AnesthesiaRecord } from './anesthesia-record.entity';
import { User } from './user.entity';

@Entity('anesthesia_billing')
export class AnesthesiaBilling {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surgical_case_id' })
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase)
  @JoinColumn({ name: 'surgical_case_id' })
  surgicalCase: SurgicalCase;

  @Column({ name: 'anesthesia_record_id', nullable: true })
  anesthesiaRecordId: string;

  @ManyToOne(() => AnesthesiaRecord)
  @JoinColumn({ name: 'anesthesia_record_id' })
  anesthesiaRecord: AnesthesiaRecord;

  // Billing Codes
  @Column({ name: 'base_units' })
  baseUnits: number;

  @Column({ name: 'time_units', type: 'decimal', precision: 4, scale: 2 })
  timeUnits: number;

  @Column({ name: 'modifying_units', default: 0 })
  modifyingUnits: number;

  @Column({ name: 'total_units', type: 'decimal', precision: 5, scale: 2, generatedType: 'STORED', asExpression: 'base_units + time_units + modifying_units' })
  totalUnits: number;

  // CPT Codes
  @Column({ name: 'anesthesia_cpt_code', length: 10, nullable: true })
  anesthesiaCptCode: string;

  @Column({ length: 20, nullable: true })
  modifiers: string;

  // Time Calculations
  @Column({ name: 'anesthesia_start', type: 'timestamptz' })
  anesthesiaStart: Date;

  @Column({ name: 'anesthesia_end', type: 'timestamptz' })
  anesthesiaEnd: Date;

  @Column({ name: 'total_minutes', type: 'integer', generatedType: 'STORED', asExpression: "EXTRACT(EPOCH FROM (anesthesia_end - anesthesia_start))/60" })
  totalMinutes: number;

  // Additional Services
  @Column({ name: 'additional_procedures', type: 'jsonb', default: [] })
  additionalProcedures: any[];

  // Billing
  @Column({ name: 'conversion_factor', type: 'decimal', precision: 8, scale: 2, default: 22.00 })
  conversionFactor: number;

  @Column({ name: 'total_charge', type: 'decimal', precision: 10, scale: 2, generatedType: 'STORED', asExpression: '(base_units + time_units + modifying_units) * conversion_factor' })
  totalCharge: number;

  @Column({ name: 'billed_at', type: 'timestamptz', nullable: true })
  billedAt: Date;

  @Column({ name: 'billed_by', nullable: true })
  billedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'billed_by' })
  billedBy: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

