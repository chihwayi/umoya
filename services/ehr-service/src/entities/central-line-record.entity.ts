import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('central_line_records')
export class CentralLineRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'line_type', type: 'text' }) lineType: string;
  @Column({ type: 'text', nullable: true }) site: string;
  @Column({ name: 'insertion_date', type: 'date' }) insertionDate: string;
  @Column({ name: 'removal_date', type: 'date', nullable: true }) removalDate: string;
  @Column({ name: 'inserted_by', type: 'uuid', nullable: true }) insertedBy: string;
  @Column({ type: 'text', nullable: true }) indication: string;
  @Column({ name: 'dressing_changes', type: 'jsonb', default: '[]' }) dressingChanges: any;
  @Column({ type: 'jsonb', default: '[]' }) complications: any;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
