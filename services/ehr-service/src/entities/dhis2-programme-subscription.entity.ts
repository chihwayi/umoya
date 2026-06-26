import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dhis2_programme_subscriptions')
export class Dhis2ProgrammeSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'indicator_code', length: 100 }) indicatorCode: string;
  @Column({ name: 'indicator_name', length: 255 }) indicatorName: string;
  @Column({ name: 'threshold_operator', length: 10, default: 'above' }) thresholdOperator: string;
  @Column({ name: 'threshold_value', type: 'float' }) thresholdValue: number;
  @Column({ name: 'alert_enabled', default: true }) alertEnabled: boolean;
  @Column({ name: 'last_value', type: 'float', nullable: true }) lastValue: number | null;
  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true }) lastCheckedAt: Date | null;
  @Column({ name: 'last_alerted_at', type: 'timestamptz', nullable: true }) lastAlertedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
