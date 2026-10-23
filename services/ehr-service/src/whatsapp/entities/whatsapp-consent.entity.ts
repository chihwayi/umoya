import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Lightweight, dedicated opt-in record rather than routing through the
 * heavier patient_consents/consent_templates signature-flow system — a
 * WhatsApp communication preference is a simple toggle, not a signed
 * clinical/procedural consent. One row per patient; opt-in/out is a
 * state transition, not an append-only log (history isn't the point here).
 */
@Entity('whatsapp_consents')
export class WhatsappConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId: string;

  @Column({ name: 'phone_number', length: 30 })
  phoneNumber: string;

  @Column({ name: 'opted_in', default: false })
  optedIn: boolean;

  @Column({ name: 'opted_in_at', type: 'timestamptz', nullable: true })
  optedInAt: Date | null;

  @Column({ name: 'opted_out_at', type: 'timestamptz', nullable: true })
  optedOutAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
