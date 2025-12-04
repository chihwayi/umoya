import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { BloodInventory } from './blood-inventory.entity';
import { User } from './user.entity';

@Entity('blood_transfusions')
export class BloodTransfusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @Column({ name: 'inventory_id' })
  inventoryId: string;

  @ManyToOne(() => BloodInventory)
  @JoinColumn({ name: 'inventory_id' })
  inventory: BloodInventory;

  @Column({ name: 'cross_match_id', nullable: true })
  crossMatchId: string;

  @Column({ name: 'ordered_by' })
  orderedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordered_by' })
  orderedBy: User;

  @Column({ name: 'order_date', type: 'timestamptz', default: () => 'NOW()' })
  orderDate: Date;

  @Column({ type: 'text' })
  indication: string;

  @Column({ name: 'pre_transfusion_vitals', type: 'jsonb', nullable: true })
  preTransfusionVitals: any;

  @Column({ name: 'consent_obtained', default: false })
  consentObtained: boolean;

  @Column({ name: 'consent_obtained_by', nullable: true })
  consentObtainedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'consent_obtained_by' })
  consentObtainedBy: User;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({ name: 'volume_transfused', nullable: true })
  volumeTransfused: number;

  @Column({ name: 'administered_by' })
  administeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'administered_by' })
  administeredBy: User;

  @Column({ name: 'monitored_by', nullable: true })
  monitoredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'monitored_by' })
  monitoredBy: User;

  @Column({ name: 'transfusion_vitals', type: 'jsonb', default: [] })
  transfusionVitals: any[];

  @Column({ name: 'transfusion_reaction', default: false })
  transfusionReaction: boolean;

  @Column({ name: 'reaction_type', length: 100, nullable: true })
  reactionType: string;

  @Column({ name: 'reaction_severity', length: 50, nullable: true })
  reactionSeverity: string;

  @Column({ name: 'reaction_time', type: 'timestamptz', nullable: true })
  reactionTime: Date;

  @Column({ name: 'reaction_management', type: 'text', nullable: true })
  reactionManagement: string;

  @Column({ name: 'transfusion_status', length: 50, default: 'ordered' })
  transfusionStatus: string;

  @Column({ name: 'completion_notes', type: 'text', nullable: true })
  completionNotes: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

