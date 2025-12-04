import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SurgicalCase } from './surgical-case.entity';
import { User } from './user.entity';

@Entity('surgical_implants')
export class SurgicalImplant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surgical_case_id', type: 'uuid' })
  surgicalCaseId: string;

  @ManyToOne(() => SurgicalCase)
  @JoinColumn({ name: 'surgical_case_id' })
  surgicalCase: SurgicalCase;

  // Implant Info
  @Column({ name: 'implant_name', length: 255 })
  implantName: string;

  @Column({ name: 'implant_type', length: 100, nullable: true })
  implantType: string;

  @Column({ length: 255, nullable: true })
  manufacturer: string;

  @Column({ name: 'catalog_number', length: 100, nullable: true })
  catalogNumber: string;

  @Column({ name: 'lot_number', length: 100, nullable: true })
  lotNumber: string;

  @Column({ name: 'serial_number', length: 100, nullable: true })
  serialNumber: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  // FDA UDI (Unique Device Identifier)
  @Column({ length: 255, nullable: true })
  udi: string;

  @Column({ name: 'udi_di', length: 100, nullable: true })
  udiDi: string;

  @Column({ name: 'udi_pi', length: 100, nullable: true })
  udiPi: string;

  // Billing
  @Column({ name: 'charge_code', length: 50, nullable: true })
  chargeCode: string;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCost: number;

  @Column({ default: true })
  billable: boolean;

  // Documentation
  @Column({ name: 'implanted_by', type: 'uuid', nullable: true })
  implantedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'implanted_by' })
  implantedByUser: User;

  @Column({ name: 'implanted_at', type: 'timestamptz', default: () => 'NOW()' })
  implantedAt: Date;

  @Column({ name: 'body_site', length: 100, nullable: true })
  bodySite: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

