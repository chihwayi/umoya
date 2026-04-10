import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('datim_indicator_mappings')
export class DatimIndicatorMapping {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'mer_indicator', length: 50 }) merIndicator: string;
  @Column({ name: 'disaggregate', length: 50 }) disaggregate: string;
  @Column({ name: 'datim_de_uid', length: 50 }) datimDeUid: string;
  @Column({ name: 'datim_coc_uid', length: 50 }) datimCocUid: string;
  @Column({ name: 'period_type', length: 10 }) periodType: string;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
