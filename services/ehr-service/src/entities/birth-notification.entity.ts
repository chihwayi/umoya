import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('birth_notifications')
export class BirthNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'mother_patient_id', type: 'uuid', nullable: true })
  motherPatientId: string | null;

  @Column({ name: 'maternity_record_id', type: 'uuid', nullable: true })
  maternityRecordId: string | null;

  @Column({ name: 'birth_date', type: 'timestamptz' })
  birthDate: Date;

  @Column({ name: 'birth_type' })
  birthType: string;

  @Column({ name: 'gestational_age_weeks', type: 'int', nullable: true })
  gestationalAgeWeeks: number | null;

  @Column({ name: 'birth_weight_grams', type: 'int', nullable: true })
  birthWeightGrams: number | null;

  @Column({ name: 'delivery_mode', nullable: true })
  deliveryMode: string | null;

  @Column({ name: 'birth_order', type: 'int', default: 1 })
  birthOrder: number;

  @Column({ name: 'plurality', nullable: true })
  plurality: string | null;

  @Column({ name: 'place_of_birth', nullable: true })
  placeOfBirth: string | null;

  @Column({ name: 'crvs_reference', nullable: true })
  crvsReference: string | null;

  @Column({ name: 'submitted_to_crvs', default: false })
  submittedToCrvs: boolean;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
