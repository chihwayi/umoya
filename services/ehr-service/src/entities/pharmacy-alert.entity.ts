import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { User } from './user.entity';

export type AlertType = 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired' | 'reorder_due' | 'price_change';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('pharmacy_alerts')
export class PharmacyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_type', type: 'varchar', length: 30 })
  alertType: AlertType;

  @ManyToOne(() => PharmacyInventory, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory?: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid', nullable: true })
  inventoryId?: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: AlertSeverity;

  @Column({ name: 'alert_message', type: 'text' })
  alertMessage: string;

  @Column({ name: 'related_data', type: 'jsonb', default: '{}' })
  relatedData: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedBy?: User;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedById?: string;

  @Column({ name: 'acknowledged_at', type: 'timestamp with time zone', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}


