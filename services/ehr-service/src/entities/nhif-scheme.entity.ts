import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('nhif_schemes')
export class NhifScheme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scheme_code', length: 20 })
  schemeCode: string;

  @Column({ name: 'scheme_name', length: 100 })
  schemeName: string;

  @Column({ name: 'country_code', length: 3 })
  countryCode: string;

  @Column({ name: 'payment_model', length: 20 })
  paymentModel: string;

  @Column({ name: 'capitation_rate', type: 'numeric', precision: 10, scale: 2, nullable: true })
  capitationRate: number | null;

  @Column({ name: 'capitation_currency', length: 5, nullable: true })
  capitationCurrency: string | null;

  @Column({ name: 'api_base_url', type: 'text', nullable: true })
  apiBaseUrl: string | null;

  @Column({ name: 'api_key_env_var', type: 'text', nullable: true })
  apiKeyEnvVar: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
