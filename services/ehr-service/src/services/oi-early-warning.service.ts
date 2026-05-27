import { Injectable, Logger } from '@nestjs/common';
import { AlertDeliveryService } from './alert-delivery.service';
import { TenantService } from './tenant.service';

interface OiInput {
  cd4Count: number | null;
  symptoms: string[];
  tbScreenPositive: boolean;
  currentRegimen: string;
  vl: number | null;
}

export interface OiAlert {
  alertType: string;
  severity: 'high' | 'urgent' | 'critical';
  alertMessage: string;
  recommendedAction: string;
  guidelineRef: string;
  triggerCd4?: number;
  triggerFinding?: string;
}

@Injectable()
export class OiEarlyWarningService {
  private readonly logger = new Logger(OiEarlyWarningService.name);

  constructor(
    private readonly alertDeliveryService: AlertDeliveryService,
    private readonly tenantService: TenantService,
  ) {}

  private static readonly RULES: Array<{
    alertType: string;
    severity: 'high' | 'urgent' | 'critical';
    check: (input: OiInput) => boolean;
    message: string;
    action: string;
    ref: string;
  }> = [
    {
      alertType: 'pcp_risk',
      severity: 'urgent',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 200,
      message: 'CD4 < 200: High risk of Pneumocystis Pneumonia (PCP). Prophylaxis indicated.',
      action: 'Start Co-trimoxazole 960mg OD prophylaxis per WHO 2021 guidelines.',
      ref: 'WHO 2021 ART Guidelines s.4.3 - PCP Prophylaxis',
    },
    {
      alertType: 'cryptococcal_risk',
      severity: 'critical',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 100,
      message: 'CD4 < 100: High risk of Cryptococcal Meningitis. Cryptococcal Antigen (CrAg) test required.',
      action: 'Order CrAg lateral flow assay. If positive, start fluconazole 800mg and refer urgently.',
      ref: 'WHO 2022 Cryptococcal Meningitis Guidelines',
    },
    {
      alertType: 'mac_risk',
      severity: 'high',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 50,
      message: 'CD4 < 50: Risk of Mycobacterium Avium Complex (MAC). Consider prophylaxis.',
      action: 'Consider Azithromycin 1200mg weekly prophylaxis. Discuss with clinician.',
      ref: 'WHO 2021 ART Guidelines s.4.5 - MAC Prophylaxis',
    },
    {
      alertType: 'cmv_risk',
      severity: 'high',
      check: ({ cd4Count, symptoms }) =>
        cd4Count !== null && cd4Count < 50 &&
        symptoms.some((s) => ['vision changes', 'floaters', 'eye pain', 'blurred vision']
          .some((k) => s.toLowerCase().includes(k))),
      message: 'CD4 < 50 + visual symptoms: CMV Retinitis must be excluded.',
      action: 'Refer urgently to ophthalmologist. Order CMV PCR.',
      ref: 'WHO 2021 ART Guidelines s.4.6 - CMV Retinitis',
    },
    {
      alertType: 'toxo_risk',
      severity: 'urgent',
      check: ({ cd4Count, symptoms }) =>
        cd4Count !== null && cd4Count < 100 &&
        symptoms.some((s) => ['headache', 'confusion', 'fever', 'seizure']
          .some((k) => s.toLowerCase().includes(k))),
      message: 'CD4 < 100 + CNS symptoms: Cerebral Toxoplasmosis or Cryptococcal Meningitis must be excluded.',
      action: 'Order CT Brain if available, CSF if safe. Empiric treatment per protocol.',
      ref: 'WHO 2021 ART Guidelines s.4.4 - Toxoplasmosis',
    },
    {
      alertType: 'tbc_risk',
      severity: 'urgent',
      check: ({ tbScreenPositive, cd4Count }) => tbScreenPositive && cd4Count !== null && cd4Count < 350,
      message: 'TB screen positive with low CD4: Active TB must be excluded before starting or continuing ART.',
      action: 'Order GeneXpert sputum. Check chest X-ray. Refer to TB/HIV integration pathway.',
      ref: 'WHO 2021 TB/HIV Co-management Guidelines',
    },
  ];

  evaluateOiRisks(input: OiInput): OiAlert[] {
    return OiEarlyWarningService.RULES
      .filter((rule) => rule.check(input))
      .map((rule) => ({
        alertType: rule.alertType,
        severity: rule.severity,
        alertMessage: rule.message,
        recommendedAction: rule.action,
        guidelineRef: rule.ref,
        triggerCd4: input.cd4Count ?? undefined,
      }));
  }

  async saveAlerts(patientId: string, alerts: OiAlert[], subdomain: string, db: any): Promise<void> {
    for (const alert of alerts) {
      const result = await db.query(
        `INSERT INTO oi_early_warning_alerts
           (patient_id, alert_type, severity, trigger_cd4, alert_message, recommended_action, guideline_ref)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (
           SELECT 1 FROM oi_early_warning_alerts
           WHERE patient_id = $1 AND alert_type = $2 AND status = 'active'
         )
         RETURNING id`,
        [
          patientId,
          alert.alertType,
          alert.severity,
          alert.triggerCd4 ?? null,
          alert.alertMessage,
          alert.recommendedAction,
          alert.guidelineRef,
        ],
      );

      if (result && result.length > 0) {
        const insertedId = result[0].id;

        // Broadcast to on-call staff
        await this.alertDeliveryService.broadcastCriticalAlert(subdomain, {
          alertType: 'OI_DETERIORATION',
          sourceEntityId: insertedId,
          patientId,
          severity: alert.severity,
          message: alert.alertMessage,
          payload: {
            oi_type: alert.alertType,
            guideline_ref: alert.guidelineRef,
          },
        });

        // Log delivery attempts
        await db.query(
          `INSERT INTO ai_alert_delivery_log
           (patient_id, alert_type, severity, delivery_channel, recipient_user_id, metadata)
           SELECT $1, 'OI_DETERIORATION', $2, 'PUSH', u.id, $3
           FROM users u
           WHERE u.role = 'nurse' AND u.on_call = TRUE`,
          [patientId, alert.severity, JSON.stringify({ oi_type: alert.alertType })],
        );
      }
    }
  }

  async getActiveAlerts(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM oi_early_warning_alerts
       WHERE patient_id = $1 AND status = 'active'
       ORDER BY severity DESC, created_at DESC`,
      [patientId],
    );
  }

  async acknowledgeAlert(alertId: string, userId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE oi_early_warning_alerts
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = now()
       WHERE id = $2`,
      [userId, alertId],
    );
  }
}
