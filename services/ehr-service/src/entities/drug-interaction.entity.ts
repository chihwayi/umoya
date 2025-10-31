import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Drug } from './drug.entity';

export enum InteractionSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CONTRAINDICATED = 'contraindicated'
}

export enum EvidenceLevel {
  ESTABLISHED = 'established',
  PROBABLE = 'probable',
  POSSIBLE = 'possible',
  UNKNOWN = 'unknown'
}

@Entity('drug_interactions')
@Index(['drug1Id', 'drug2Id'], { unique: true })
export class DrugInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'drug1_id' })
  drug1Id: string;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drug1_id' })
  drug1: Drug;

  @Column({ name: 'drug2_id' })
  drug2Id: string;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drug2_id' })
  drug2: Drug;

  @Column({ type: 'varchar' })
  severity: InteractionSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'text' })
  mechanism: string;

  @Column({ nullable: true, type: 'text' })
  management: string;

  @Column({ name: 'evidence_level', nullable: true, type: 'varchar' })
  evidenceLevel: EvidenceLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

