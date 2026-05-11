import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('patient_family_access')
export class PatientFamilyAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'proxy_name', length: 255 })
  proxyName: string;

  @Column({ name: 'proxy_email', length: 255 })
  proxyEmail: string;

  @Column({ name: 'proxy_phone', length: 30, nullable: true })
  proxyPhone: string | null;

  @Column({ length: 50, nullable: true })
  relationship: string | null;

  @Column({ name: 'access_level', length: 30, default: 'view_only' })
  accessLevel: string;

  @Column({ name: 'granted_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  grantedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'password_hash', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'password_set_at', type: 'timestamp with time zone', nullable: true })
  passwordSetAt: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
