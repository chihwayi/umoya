import { Injectable } from '@nestjs/common';

export const CONSENT_TYPES = {
  HIV_TESTING: 'hiv_testing',
  DATA_SHARING_RESEARCH: 'data_sharing_research',
  SMS_COMMUNICATION: 'sms_communication',
  TREATMENT: 'treatment',
  PHOTOGRAPHY: 'photography',
  MINOR_ASSENT: 'minor_assent',
} as const;

export type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];

@Injectable()
export class ConsentRecordsService {
  async grantConsent(
    data: {
      patientId: string;
      consentType: ConsentType;
      purpose: string;
      dataCategories: string[];
      expiresAt?: string;
      collectedBy: string;
      ipAddress?: string;
      signatureRef?: string;
    },
    db: any,
  ): Promise<{ id: string }> {
    const rows: { id: string }[] = await db.query(
      `INSERT INTO patient_consent_records (
         patient_id, consent_type, purpose, data_categories, granted, granted_at,
         expires_at, collected_by, ip_address, signature_ref
       ) VALUES ($1,$2,$3,$4,true,NOW(),$5,$6,$7,$8)
       RETURNING id`,
      [
        data.patientId, data.consentType, data.purpose,
        data.dataCategories, data.expiresAt ?? null,
        data.collectedBy, data.ipAddress ?? null, data.signatureRef ?? null,
      ],
    );
    return rows[0];
  }

  async withdrawConsent(consentId: string, reason: string, db: any): Promise<void> {
    await db.query(
      `UPDATE patient_consent_records SET withdrawn_at = NOW(), withdrawn_reason = $2, granted = false WHERE id = $1`,
      [consentId, reason],
    );
  }

  async getPatientConsents(patientId: string, db: any) {
    return db.query(
      `SELECT * FROM patient_consent_records WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId],
    );
  }

  async hasActiveConsent(patientId: string, consentType: ConsentType, db: any): Promise<boolean> {
    const rows: { cnt: number }[] = await db.query(
      `SELECT COUNT(*)::int as cnt FROM patient_consent_records
       WHERE patient_id = $1 AND consent_type = $2 AND granted = true
         AND withdrawn_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [patientId, consentType],
    );
    return (rows?.[0]?.cnt ?? 0) > 0;
  }

  async getExpiringConsents(daysAhead: number, db: any) {
    return db.query(
      `SELECT c.*, p.first_name, p.last_name, p.phone_number
       FROM patient_consent_records c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.granted = true AND c.withdrawn_at IS NULL
         AND c.expires_at BETWEEN NOW() AND NOW() + ($1 || ' days')::INTERVAL
       ORDER BY c.expires_at ASC`,
      [daysAhead],
    );
  }
}
