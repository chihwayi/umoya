import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('nutritional_screenings')
export class NutritionalScreening {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'screened_by', type: 'uuid' }) screenedBy: string;
  @Column({ name: 'screening_tool', type: 'text' }) screeningTool: string;
  @Column({ name: 'total_score', type: 'smallint' }) totalScore: number;
  @Column({ name: 'risk_category', type: 'text' }) riskCategory: string;
  @Column({ name: 'follow_up_required', type: 'boolean', default: false }) followUpRequired: boolean;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ name: 'screened_at', type: 'timestamptz' }) screenedAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
