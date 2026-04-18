import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ihr_notifications' })
export class IhrNotification {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'event_type', type: 'text' }) eventType: string;

  @Column({ name: 'disease', type: 'text' }) disease: string;

  @Column({ name: 'disease_category', type: 'text', nullable: true }) diseaseCategory: string | null;

  @Column({ name: 'case_count', type: 'int', default: 1 }) caseCount: number;

  @Column({ name: 'death_count', type: 'int', default: 0 }) deathCount: number;

  @Column({ name: 'facility_name', type: 'text', nullable: true }) facilityName: string | null;

  @Column({ name: 'district', type: 'text', nullable: true }) district: string | null;

  @Column({ name: 'province', type: 'text', nullable: true }) province: string | null;

  @Column({ name: 'affected_country', type: 'text' }) affectedCountry: string;

  @Column({ name: 'ihr_annex2_criteria_met', type: 'jsonb', default: {} }) ihrAnnex2CriteriaMet: Record<string, any>;

  @Column({ name: 'pheic_relevant', default: false }) pheicRelevant: boolean;

  @Column({ name: 'cdss_annex2_assessment', type: 'jsonb', default: {} }) cdssAnnex2Assessment: Record<string, any>;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number | null;

  @Column({ name: 'source_case_ids', type: 'jsonb', default: [] }) sourceCaseIds: string[];

  @Column({ name: 'local_case_ref', type: 'text', nullable: true }) localCaseRef: string | null;

  @Column({ name: 'notification_date', type: 'timestamp' }) notificationDate: Date;

  @Column({ name: 'notified_nfp', default: false }) notifiedNfp: boolean;

  @Column({ name: 'nfp_notified_at', type: 'timestamp', nullable: true }) nfpNotifiedAt: Date | null;

  @Column({ name: 'nfp_contact_name', type: 'text', nullable: true }) nfpContactName: string | null;

  @Column({ name: 'notified_who_afro', default: false }) notifiedWhoAfro: boolean;

  @Column({ name: 'who_afro_notified_at', type: 'timestamp', nullable: true }) whoAfroNotifiedAt: Date | null;

  @Column({ name: 'who_event_id', type: 'text', nullable: true }) whoEventId: string | null;

  @Column({ name: 'who_acknowledgement', type: 'jsonb', default: {} }) whoAcknowledgement: Record<string, any>;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true }) submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true }) submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
}
