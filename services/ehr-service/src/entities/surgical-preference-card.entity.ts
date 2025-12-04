import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('surgical_preference_cards')
export class SurgicalPreferenceCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surgeon_id', type: 'uuid' })
  surgeonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'surgeon_id' })
  surgeon: User;

  @Column({ name: 'procedure_name', length: 255 })
  procedureName: string;

  @Column({ name: 'procedure_code_cpt', length: 10, nullable: true })
  procedureCodeCpt: string;

  // Preferences
  @Column({ name: 'preferred_or_type', length: 50, nullable: true })
  preferredOrType: string;

  @Column({ name: 'preferred_position', length: 50, nullable: true })
  preferredPosition: string;

  @Column({ name: 'preferred_anesthesia', length: 50, nullable: true })
  preferredAnesthesia: string;

  // Equipment & Supplies
  @Column({ name: 'required_equipment', type: 'jsonb', default: '[]' })
  requiredEquipment: any[];

  @Column({ name: 'preferred_instruments', type: 'jsonb', default: '[]' })
  preferredInstruments: any[];

  @Column({ name: 'suture_preferences', type: 'jsonb', default: '[]' })
  suturePreferences: any[];

  @Column({ name: 'supply_list', type: 'jsonb', default: '[]' })
  supplyList: any[];

  @Column({ name: 'implant_options', type: 'jsonb', default: '[]' })
  implantOptions: any[];

  @Column({ name: 'preferred_scrub_tech', length: 255, nullable: true })
  preferredScrubTech: string;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

