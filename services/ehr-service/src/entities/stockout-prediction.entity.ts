import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('stockout_predictions')
export class StockoutPrediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'drug_id', nullable: true })
  drugId: string;

  @Column({ name: 'drug_name' })
  drugName: string;

  @Column({ name: 'current_stock_units', type: 'float', default: 0 })
  currentStockUnits: number;

  @Column({ name: 'avg_daily_consumption', type: 'float', default: 0 })
  avgDailyConsumption: number;

  @Column({ name: 'days_to_stockout', type: 'float', nullable: true })
  daysToStockout: number;

  @Column({ name: 'predicted_stockout_date', type: 'date', nullable: true })
  predictedStockoutDate: string;

  @Column({ name: 'safety_stock_days', type: 'float', default: 30 })
  safetyStockDays: number;

  @Column({ name: 'reorder_quantity', type: 'float', nullable: true })
  reorderQuantity: number;

  @Column({ name: 'risk_level' }) // critical | high | medium | low
  riskLevel: string;

  @Column({ name: 'seasonal_factor', type: 'float', default: 1.0 })
  seasonalFactor: number;

  @CreateDateColumn({ name: 'predicted_at' })
  predictedAt: Date;
}
