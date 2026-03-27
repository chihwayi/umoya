import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('claim_appeals')
export class ClaimAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  @Index()
  claimId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'denial_reason_code', type: 'varchar', length: 50 })
  denialReasonCode: string;

  @Column({ name: 'denial_reason_description', type: 'text' })
  denialReasonDescription: string;

  @Column({ name: 'draft_letter', type: 'text' })
  draftLetter: string;

  @Column({ name: 'rag_sources', type: 'jsonb', default: [] })
  ragSources: Array<{ documentId: string; title: string; excerpt: string; relevanceScore: number }>;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'draft' })
  status: 'draft' | 'submitted' | 'won' | 'lost' | 'withdrawn';

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'outcome_at', type: 'timestamptz', nullable: true })
  outcomeAt: Date | null;

  @Column({ name: 'outcome_notes', type: 'text', nullable: true })
  outcomeNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
