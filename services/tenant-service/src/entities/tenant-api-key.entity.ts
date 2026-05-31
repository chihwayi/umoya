import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Per-tenant programmatic API key. The full secret is shown ONCE on creation
 * and never stored — only its SHA-256 hash (keys are high-entropy random
 * secrets, so a fast hash is appropriate; bcrypt is for low-entropy passwords).
 */
@Entity('tenant_api_keys')
export class TenantApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ length: 120 })
  name: string;

  // Human-readable identifier prefix, e.g. "umoya_ab12cd34" — safe to display.
  @Column({ length: 24 })
  keyPrefix: string;

  // SHA-256 hex of the full key. Unique so a presented key maps to one record.
  @Index({ unique: true })
  @Column({ length: 128 })
  keyHash: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
