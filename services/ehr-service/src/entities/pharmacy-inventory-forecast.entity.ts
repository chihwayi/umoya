import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { User } from './user.entity';

@Entity('pharmacy_inventory_forecasts')
export class PharmacyInventoryForecast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyInventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: PharmacyInventory;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'generated_by' })
  generatedBy?: User;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedById?: string;

  @Column({ name: 'forecast_horizon_days', type: 'int', default: 30 })
  forecastHorizonDays: number;

  @Column({ name: 'lookback_days', type: 'int', default: 30 })
  lookbackDays: number;

  @Column({ name: 'forecast_status', type: 'varchar', length: 30, default: 'generated' })
  forecastStatus: string;

  @Column({ name: 'inventory_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  inventorySnapshot: Record<string, any>;

  @Column({ name: 'usage_metrics', type: 'jsonb', default: () => "'{}'::jsonb" })
  usageMetrics: Record<string, any>;

  @Column({ name: 'projected_demand', type: 'decimal', precision: 12, scale: 2, default: 0 })
  projectedDemand: number;

  @Column({ name: 'average_daily_usage', type: 'decimal', precision: 12, scale: 4, default: 0 })
  averageDailyUsage: number;

  @Column({ name: 'predicted_stockout_date', type: 'timestamptz', nullable: true })
  predictedStockoutDate?: Date | null;

  @Column({ name: 'days_until_stockout', type: 'decimal', precision: 10, scale: 2, nullable: true })
  daysUntilStockout?: number | null;

  @Column({ name: 'shortage_risk', type: 'varchar', length: 20, default: 'low' })
  shortageRisk: string;

  @Column({ name: 'recommended_order_quantity', type: 'int', default: 0 })
  recommendedOrderQuantity: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  governance: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
