import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('allergies')
export class Allergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column()
  allergen: string;

  @Column({ name: 'allergen_snomed_code', nullable: true })
  allergenSnomedCode: string;

  @Column({ name: 'allergen_snomed_term', type: 'text', nullable: true })
  allergenSnomedTerm: string;

  @Column({ name: 'allergen_snomed_module_id', nullable: true })
  allergenSnomedModuleId: string;

  @Column({ type: 'text', nullable: true })
  reaction: string;

  @Column({ name: 'reaction_snomed_code', nullable: true })
  reactionSnomedCode: string;

  @Column({ name: 'reaction_snomed_term', type: 'text', nullable: true })
  reactionSnomedTerm: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  severity: 'mild' | 'moderate' | 'severe';

  @Column({ name: 'severity_snomed_code', nullable: true })
  severitySnomedCode: string;

  @Column({ name: 'severity_snomed_term', type: 'text', nullable: true })
  severitySnomedTerm: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User;

  @Column({ name: 'verification_status', nullable: true })
  verificationStatus: string;

  @Column({ name: 'clinical_status', nullable: true })
  clinicalStatus: string;
}


