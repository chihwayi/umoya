import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('antibiogram_entries')
export class AntibiogramEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) organism: string;
  @Column({ type: 'text' }) antibiotic: string;
  @Column({ type: 'int' }) year: number;
  @Column({ type: 'smallint', nullable: true }) quarter: number;
  @Column({ name: 'susceptible_percent', type: 'numeric' }) susceptiblePercent: number;
  @Column({ name: 'intermediate_percent', type: 'numeric', default: 0 }) intermediatePercent: number;
  @Column({ name: 'resistant_percent', type: 'numeric' }) resistantPercent: number;
  @Column({ name: 'total_isolates', type: 'int' }) totalIsolates: number;
  @Column({ name: 'specimen_type', type: 'text' }) specimenType: string; // wound|urine|blood|sputum|stool|other
  @Column({ type: 'text', nullable: true }) ward: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
