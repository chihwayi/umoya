import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

@Entity('pediatric_profiles')
export class PediatricProfile {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true }) patientId: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' }) patient?: Patient;

  @Column({ name: 'gestational_age_weeks', type: 'numeric', precision: 4, scale: 1, nullable: true }) gestationalAgeWeeks?: number;
  @Column({ name: 'birth_weight_grams', type: 'int', nullable: true }) birthWeightGrams?: number;
  @Column({ name: 'birth_length_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) birthLengthCm?: number;
  @Column({ name: 'birth_head_circ_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) birthHeadCircCm?: number;
  @Column({ name: 'apgar_1min', type: 'int', nullable: true }) apgar1min?: number;
  @Column({ name: 'apgar_5min', type: 'int', nullable: true }) apgar5min?: number;
  /** vaginal | caesarean | instrumental | unknown */
  @Column({ name: 'delivery_type', length: 20, nullable: true }) deliveryType?: string;
  /** breast | formula | mixed | unknown */
  @Column({ name: 'feeding_type', length: 20, default: 'unknown' }) feedingType: string = 'unknown';
  @Column({ name: 'neonatal_complications', type: 'text', nullable: true }) neonatalComplications?: string;
  @Column({ name: 'blood_group', length: 5, nullable: true }) bloodGroup?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
