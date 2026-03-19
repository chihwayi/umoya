import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('typhoid_cases')
export class TyphoidCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'onset_date', type: 'date' }) onsetDate: string;
  @Column({ name: 'widal_titer', type: 'text', nullable: true }) widalTiter: string;
  @Column({ name: 'blood_culture_result', type: 'text', nullable: true }) bloodCultureResult: string; // negative|S_typhi|S_paratyphi_A|S_paratyphi_B
  @Column({ name: 'resistance_pattern', type: 'text', array: true, nullable: true }) resistancePattern: string[];
  @Column({ name: 'chloramphenicol_sensitivity', type: 'text', nullable: true }) chloramphenicolSensitivity: string; // sensitive|resistant|intermediate
  @Column({ type: 'text', nullable: true }) treatment: string;
  @Column({ type: 'text', array: true, nullable: true }) complication: string[];
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
