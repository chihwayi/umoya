import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sdoh_screening_logs')
export class SdohScreeningLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'screening_date', type: 'date' }) screeningDate: string;
  @Column({ name: 'tool_used', type: 'text' }) toolUsed: string; // PRAPARE|AHC_HRSN|SEEK
  @Column({ type: 'jsonb', default: {} }) responses: Record<string, any>;
  @Column({ name: 'positive_screens', type: 'jsonb', default: [] }) positiveScreens: any[];
  @Column({ name: 'z_codes', type: 'text', array: true, nullable: true }) zCodes: string[];
  @Column({ name: 'conducted_by', type: 'uuid' }) conductedBy: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
