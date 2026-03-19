import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('developmental_milestones')
export class DevelopmentalMilestone {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  /** gross_motor | fine_motor | language | social | cognitive | adaptive */
  @Column({ length: 30 }) domain: string;
  @Column({ length: 200 }) milestone: string;
  @Column({ name: 'expected_age_months', type: 'int', nullable: true }) expectedAgeMonths?: number;
  @Column({ name: 'achieved_date', type: 'date', nullable: true }) achievedDate?: Date;
  @Column({ name: 'age_at_achievement_months', type: 'int', nullable: true }) ageAtAchievementMonths?: number;

  /** achieved | delayed | referred | pending */
  @Column({ length: 20, default: 'pending' }) status: string = 'pending';

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true }) assessedById?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessed_by' }) assessedBy?: User;

  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
