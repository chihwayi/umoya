import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mobile_money_configs')
export class MobileMoneyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider', length: 30 })
  provider: string; // mpesa | mtn_momo | ecocash | airtel | flutterwave

  @Column({ name: 'country_code', length: 3 })
  countryCode: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'api_base_url', type: 'text' })
  apiBaseUrl: string;

  @Column({ name: 'business_short_code', length: 20, nullable: true })
  businessShortCode: string | null;

  @Column({ name: 'till_number', length: 20, nullable: true })
  tillNumber: string | null;

  @Column({ name: 'merchant_id', length: 50, nullable: true })
  merchantId: string | null;

  @Column({ name: 'callback_url', type: 'text' })
  callbackUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
