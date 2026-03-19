import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('neurology_examinations')
export class NeurologyExamination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'examined_by', type: 'uuid' })
  examinedBy: string;

  @Column({ name: 'exam_date', type: 'timestamptz', default: () => 'now()' })
  examDate: Date;

  @Column({ name: 'cranial_nerves', type: 'jsonb', default: {} })
  cranialNerves: Record<string, any>;

  @Column({ name: 'motor_exam', type: 'jsonb', default: {} })
  motorExam: Record<string, any>;

  @Column({ name: 'sensory_exam', type: 'jsonb', default: {} })
  sensoryExam: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  cerebellar: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  gait: string | null;

  @Column({ type: 'jsonb', default: {} })
  reflexes: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  mmt: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
