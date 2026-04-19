import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'ussd_clinical_entries' })
export class UssdClinicalEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id' }) sessionId: string;
  @Column({ name: 'phone_number' }) phoneNumber: string;
  @Column({ name: 'chw_user_id', nullable: true }) chwUserId: string;
  @Column({ name: 'entry_type' }) entryType: string;
  @Column({ name: 'patient_id', nullable: true }) patientId: string;
  @Column({ name: 'patient_identifier', nullable: true }) patientIdentifier: string;
  @Column({ name: 'data_entered', type: 'jsonb', default: {} }) dataEntered: object;
  @Column({ name: 'processed', default: false }) processed: boolean;
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true }) processedAt: Date;
  @Column({ name: 'processing_result', type: 'jsonb', default: {} }) processingResult: object;
  @Column({ name: 'error_message', nullable: true }) errorMessage: string;
  @Column({ name: 'menu_state', nullable: true }) menuState: string;
  @Column({ name: 'session_complete', default: false }) sessionComplete: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
