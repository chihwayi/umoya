import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('renal_biopsies')
export class RenalBiopsy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'performed_by', type: 'uuid' }) performedBy: string;
  @Column({ name: 'biopsy_date', type: 'date' }) biopsyDate: string;
  @Column({ type: 'text' }) indication: string;
  @Column({ name: 'egfr_at_biopsy', type: 'numeric', precision: 6, scale: 2, nullable: true }) egfrAtBiopsy: number;
  @Column({ type: 'text', nullable: true }) histopathology: string;
  @Column({ name: 'pathology_report', type: 'text', nullable: true }) pathologyReport: string;
  @Column({ type: 'text', nullable: true }) immunofluorescence: string;
  @Column({ name: 'electron_microscopy', type: 'text', nullable: true }) electronMicroscopy: string;
  @Column({ type: 'text', nullable: true }) diagnosis: string;
  @Column({ type: 'text', nullable: true }) recommendation: string;
  @Column({ type: 'text', nullable: true }) complications: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
