import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('adherence_chat_logs')
export class AdherenceChatLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'message_role' }) // user | assistant
  messageRole: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'intent', nullable: true }) // adherence_check | side_effect | refill_request | general
  intent: string;

  @Column({ name: 'medications_discussed', type: 'jsonb', default: '[]' })
  medicationsDiscussed: string[];

  @Column({ name: 'adherence_concern_flagged', default: false })
  adherenceConcernFlagged: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
