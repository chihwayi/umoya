import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('post_visit_companion_acknowledgements')
export class PostVisitCompanionAcknowledgement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'acknowledgement_type', type: 'varchar', length: 60 })
  acknowledgementType:
    | 'teach_back'
    | 'medication_adherence'
    | 'follow_up_commitment'
    | 'warning_sign_understanding';

  @Column({ type: 'boolean', default: true })
  acknowledged: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, any>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
