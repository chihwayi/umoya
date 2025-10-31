import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('lab_tests')
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'loinc_code', nullable: true, unique: true })
  loincCode: string;

  @Column({ name: 'test_name' })
  testName: string;

  @Column({ name: 'test_code', nullable: true })
  testCode: string;

  @Column()
  category: string;

  @Column({ name: 'specimen_type' })
  specimenType: string;

  @Column({ nullable: true })
  unit: string;

  @Column({ name: 'reference_range_male', nullable: true })
  referenceRangeMale: string;

  @Column({ name: 'reference_range_female', nullable: true })
  referenceRangeFemale: string;

  @Column({ name: 'reference_range_general', nullable: true })
  referenceRangeGeneral: string;

  @Column({ name: 'critical_high', type: 'decimal', nullable: true })
  criticalHigh: number;

  @Column({ name: 'critical_low', type: 'decimal', nullable: true })
  criticalLow: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

