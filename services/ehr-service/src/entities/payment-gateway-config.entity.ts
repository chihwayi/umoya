import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PaymentProviderType {
  ECOCASH = 'ecocash',
  ONEMONEY = 'onemoney',
  TELECASH = 'telecash',
  PAYNOW = 'paynow',
  POLLARIUM = 'pollarium',
  STRIPE = 'stripe',
  OTHER = 'other'
}

@Entity('payment_gateway_configurations')
@Index(['providerType'])
@Index(['isActive'])
export class PaymentGatewayConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_type', type: 'varchar', length: 50 })
  providerType: PaymentProviderType;

  @Column({ name: 'provider_name', type: 'varchar', length: 100, nullable: true })
  providerName: string;

  @Column({ name: 'api_url', type: 'varchar', length: 500 })
  apiUrl: string;

  @Column({ name: 'merchant_id', type: 'varchar', length: 100, nullable: true })
  merchantId: string;

  @Column({ name: 'integration_key', type: 'varchar', length: 255, nullable: true })
  integrationKey: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  apiKey: string;

  @Column({ name: 'api_secret', type: 'varchar', length: 255, nullable: true })
  apiSecret: string;

  @Column({ name: 'webhook_url', type: 'varchar', length: 500, nullable: true })
  webhookUrl: string;

  @Column({ name: 'webhook_secret', type: 'varchar', length: 255, nullable: true })
  webhookSecret: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_test_mode', default: false })
  isTestMode: boolean;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
