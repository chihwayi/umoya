import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('procurement_alerts')
export class ProcurementAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prediction_id' })
  predictionId: string;

  @Column({ name: 'drug_name' })
  drugName: string;

  @Column({ name: 'days_to_stockout', type: 'float' })
  daysToStockout: number;

  @Column({ name: 'recommended_order_qty', type: 'float' })
  recommendedOrderQty: number;

  @Column({ name: 'urgency' }) // immediate | within_7_days | within_30_days
  urgency: string;

  @Column({ name: 'status', default: 'open' }) // open | acknowledged | ordered | resolved
  status: string;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'order_reference', nullable: true })
  orderReference: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
