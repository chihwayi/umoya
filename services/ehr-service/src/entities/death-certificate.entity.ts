import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('death_certificates')
export class DeathCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'death_date', type: 'date' })
  deathDate: string;

  @Column({ name: 'death_time', type: 'time', nullable: true })
  deathTime: string | null;

  @Column({ name: 'place_of_death', nullable: true })
  placeOfDeath: string | null;

  @Column({ name: 'cause_of_death_primary' })
  causeOfDeathPrimary: string;

  @Column({ name: 'cause_of_death_icd10' })
  causeOfDeathIcd10: string;

  @Column({ name: 'cause_of_death_secondary', nullable: true })
  causeOfDeathSecondary: string | null;

  @Column({ name: 'cause_of_death_secondary_icd10', nullable: true })
  causeOfDeathSecondaryIcd10: string | null;

  @Column({ name: 'manner_of_death', nullable: true })
  mannerOfDeath: string | null;

  @Column({ name: 'certifying_provider', type: 'uuid', nullable: true })
  certifyingProvider: string | null;

  @Column({ name: 'crvs_reference', nullable: true })
  crvsReference: string | null;

  @Column({ name: 'submitted_to_crvs', default: false })
  submittedToCrvs: boolean;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'pdf_path', type: 'text', nullable: true })
  pdfPath: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
