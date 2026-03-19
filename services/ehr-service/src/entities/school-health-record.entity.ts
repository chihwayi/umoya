import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('school_health_records')
export class SchoolHealthRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' }) assessmentDate: Date;
  @Column({ length: 10, nullable: true }) grade?: string;
  @Column({ name: 'school_name', length: 150, nullable: true }) schoolName?: string;

  @Column({ name: 'vision_right', length: 20, nullable: true }) visionRight?: string;
  @Column({ name: 'vision_left', length: 20, nullable: true }) visionLeft?: string;
  @Column({ name: 'vision_status', length: 20, nullable: true }) visionStatus?: string;
  @Column({ name: 'hearing_status', length: 20, nullable: true }) hearingStatus?: string;
  @Column({ name: 'dental_status', length: 30, nullable: true }) dentalStatus?: string;
  @Column({ name: 'immunization_up_to_date', type: 'boolean', nullable: true }) immunizationUpToDate?: boolean;
  @Column({ name: 'growth_status', length: 30, nullable: true }) growthStatus?: string;
  @Column({ type: 'jsonb', default: '[]' }) referrals: any[];

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true }) assessedById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessed_by' }) assessedBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
