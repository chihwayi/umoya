import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('iot_device_registrations')
export class IotDeviceRegistration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'device_type', type: 'text' }) deviceType: string; // CGM|BP_monitor|pulse_oximeter|smartwatch|scale
  @Column({ type: 'text', nullable: true }) manufacturer: string;
  @Column({ type: 'text', nullable: true }) model: string;
  @Column({ name: 'serial_number', type: 'text', nullable: true }) serialNumber: string;
  @Column({ name: 'oauth_token_encrypted', type: 'text', nullable: true }) oauthTokenEncrypted: string;
  @Column({ name: 'oauth_expires_at', type: 'timestamptz', nullable: true }) oauthExpiresAt: Date;
  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true }) lastSyncAt: Date;
  @Column({ type: 'text', default: 'active' }) status: string; // active|revoked|expired
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
