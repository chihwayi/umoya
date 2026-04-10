import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ussd_sessions')
export class UssdSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'session_id', length: 100, unique: true })
  sessionId: string;

  @Column({ name: 'phone_number', length: 30 })
  phoneNumber: string;

  @Column({ name: 'service_code', length: 20, nullable: true })
  serviceCode: string | null;

  @Column({ name: 'current_menu', length: 50, nullable: true })
  currentMenu: string | null;

  @Column({ name: 'session_state', type: 'jsonb', default: {} })
  sessionState: Record<string, any>;

  @Column({ name: 'ended', default: false })
  ended: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
