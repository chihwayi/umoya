import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { encryptionTransformer } from '../../transformers/encryption.transformer';

/**
 * One row per tenant (a tenant typically has exactly one WhatsApp Business
 * number — multi-number support can add a `location_id` column later if a
 * tenant ever needs per-branch numbers, mirroring Aurelia's channel model).
 * Secrets are encrypted at rest with the same AES-256-GCM transformer used
 * for other sensitive columns elsewhere in this service.
 */
@Entity('whatsapp_channel_configs')
export class WhatsappChannelConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Meta's phone_number_id for this tenant's WhatsApp Business number. */
  @Column({ name: 'phone_number_id', length: 50 })
  phoneNumberId: string;

  @Column({ name: 'business_account_id', length: 50, nullable: true })
  businessAccountId: string | null;

  @Column({ name: 'access_token', type: 'text', transformer: encryptionTransformer })
  accessToken: string;

  @Column({ name: 'app_secret', type: 'text', transformer: encryptionTransformer })
  appSecret: string;

  @Column({ name: 'webhook_verify_token', type: 'text', transformer: encryptionTransformer })
  webhookVerifyToken: string;

  @Column({ name: 'api_version', length: 10, default: 'v21.0' })
  apiVersion: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
