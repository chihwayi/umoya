import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SmsProviderType {
  ECONET = 'econet',
  NETONE = 'netone',
  TELECEL = 'telecel',
  TWILIO = 'twilio',
  CLICKATELL = 'clickatell',
  OTHER = 'other'
}

@Entity('sms_gateway_configurations')
@Index(['providerType'])
@Index(['isActive'])
export class SmsGatewayConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_type', type: 'varchar', length: 50 })
  providerType: SmsProviderType;

  @Column({ name: 'provider_name', type: 'varchar', length: 100, nullable: true })
  providerName: string;

  @Column({ name: 'api_url', type: 'varchar', length: 500 })
  apiUrl: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  apiKey: string;

  @Column({ name: 'api_secret', type: 'varchar', length: 255, nullable: true })
  apiSecret: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 50, nullable: true })
  senderId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
