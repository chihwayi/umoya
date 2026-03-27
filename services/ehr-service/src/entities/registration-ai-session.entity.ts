import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('registration_ai_sessions')
export class RegistrationAiSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  @Index()
  patientId: string | null;

  @Column({ name: 'session_token', type: 'varchar', length: 100 })
  @Index({ unique: true })
  sessionToken: string;

  @Column({ name: 'phonetic_matches_found', type: 'int', default: 0 })
  phoneticMatchesFound: number;

  @Column({ name: 'duplicate_dismissed', type: 'boolean', default: false })
  duplicateDismissed: boolean;

  @Column({ name: 'ocr_attempted', type: 'boolean', default: false })
  ocrAttempted: boolean;

  @Column({ name: 'ocr_success', type: 'boolean', default: false })
  ocrSuccess: boolean;

  @Column({ name: 'ocr_fields_accepted', type: 'jsonb', default: [] })
  ocrFieldsAccepted: string[];

  @Column({ name: 'sdoh_screening_completed', type: 'boolean', default: false })
  sdohScreeningCompleted: boolean;

  @Column({ name: 'sdoh_screening_id', type: 'uuid', nullable: true })
  sdohScreeningId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
