import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('skin_lesions')
export class SkinLesion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt: Date;
  @Column({ name: 'body_location', type: 'jsonb', default: '{}' }) bodyLocation: any;
  @Column({ name: 'lesion_type', type: 'text', nullable: true }) lesionType: string;
  @Column({ type: 'jsonb', default: '{}' }) dimensions: any;
  @Column({ type: 'text', nullable: true }) morphology: string;
  @Column({ type: 'text', nullable: true }) colour: string;
  @Column({ type: 'text', nullable: true }) borders: string;
  @Column({ type: 'text', nullable: true }) surface: string;
  @Column({ type: 'jsonb', default: '{}' }) evolution: any;
  @Column({ name: 'photograph_key', type: 'text', nullable: true }) photographKey: string;
  @Column({ name: 'dermoscopy_key', type: 'text', nullable: true }) dermoscopyKey: string;
  @Column({ name: 'ai_classification', type: 'jsonb', nullable: true }) aiClassification: any;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
