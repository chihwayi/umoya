import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AcknowledgeAlertDto, ResolveAlertDto } from '../dto/diabetes.dto';
import { DiabetesService } from './diabetes.service';

@Injectable()
export class DiabetesCdsService {
  private readonly logger = new Logger(DiabetesCdsService.name);

  constructor(private readonly diabetesService: DiabetesService) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  async getActiveAlerts(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `
        SELECT *
        FROM diabetes_alerts
        WHERE diabetes_registry_id = $1
          AND resolved = false
        ORDER BY created_at DESC
      `,
      [registryId],
    );
  }

  async acknowledgeAlert(
    tenantDb: DataSource,
    alertId: string,
    userId: string | null,
    dto: AcknowledgeAlertDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [updated] = await tenantDb.query(
      `
        UPDATE diabetes_alerts
        SET acknowledged = true,
            acknowledged_by = COALESCE($2, acknowledged_by),
            acknowledged_at = NOW(),
            resolution_notes = CASE WHEN $3 IS NULL THEN resolution_notes ELSE COALESCE(resolution_notes, '') || '\nAck: ' || $3 END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [alertId, userId, dto.note ?? null],
    );
    if (!updated) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return updated;
  }

  async resolveAlert(
    tenantDb: DataSource,
    alertId: string,
    userId: string | null,
    dto: ResolveAlertDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [updated] = await tenantDb.query(
      `
        UPDATE diabetes_alerts
        SET resolved = true,
            resolved_by = COALESCE($2, resolved_by),
            resolved_at = NOW(),
            resolution_notes = COALESCE(resolution_notes, '') || '\nResolution: ' || COALESCE($3, 'No notes provided'),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [alertId, userId, dto.resolutionNotes ?? dto.note ?? null],
    );
    if (!updated) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return updated;
  }

  async generateAlerts(
    tenantDb: DataSource,
    registryId: string,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const [registry] = await tenantDb.query(
      `SELECT id, patient_id FROM diabetes_registry WHERE id = $1`,
      [registryId],
    );
    if (!registry) {
      throw new NotFoundException(`Diabetes registry ${registryId} not found`);
    }
    const patientId: string = registry.patient_id;

    await this.diabetesService.syncVitalsGlucose(tenantDb, registryId);
    await this.diabetesService.syncCareBundleFromLabs(tenantDb, registryId);
    await this.diabetesService.syncMedicationsFromPrescriptions(tenantDb, registryId);

    const latestBundle = await this.diabetesService.getLatestCareBundle(tenantDb, registryId);
    const screeningStatus = await this.diabetesService.checkScreeningDue(tenantDb, registryId);
    const activeAlerts = await this.getActiveAlerts(tenantDb, registryId);

    const shouldCreate = (type: string, metric?: string | null) =>
      !activeAlerts.some(
        (alert: any) =>
          alert.alert_type === type &&
          (metric ? alert.related_metric === metric : true) &&
          alert.resolved === false,
      );

    const createdAlerts = [];

    if (!latestBundle && shouldCreate('care_bundle_incomplete', 'bundle_missing')) {
      const alert = await this.diabetesService.createAlert(
        tenantDb,
        registryId,
        patientId,
        {
          alertType: 'care_bundle_incomplete',
          alertSeverity: 'medium',
          alertMessage: 'No diabetes care bundle has been documented for this registry.',
          relatedMetric: 'bundle_missing',
        },
        userId,
      );
      createdAlerts.push(alert);
    }

    if (latestBundle?.hba1c_value !== null) {
      if (latestBundle.hba1c_value >= 9 && shouldCreate('abnormal_value', 'hba1c')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'abnormal_value',
              alertSeverity: 'high',
              alertMessage: `Latest HbA1c ${latestBundle.hba1c_value}% exceeds the 9% threshold.`,
              relatedMetric: 'hba1c',
              relatedValue: latestBundle.hba1c_value,
              relatedDate: latestBundle.hba1c_date ?? latestBundle.bundle_date,
            },
            userId,
          ),
        );
      } else if (latestBundle.hba1c_value >= 8 && shouldCreate('abnormal_value', 'hba1c_warning')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'abnormal_value',
              alertSeverity: 'medium',
              alertMessage: `HbA1c ${latestBundle.hba1c_value}% is above the 8% target.`,
              relatedMetric: 'hba1c_warning',
              relatedValue: latestBundle.hba1c_value,
              relatedDate: latestBundle.hba1c_date ?? latestBundle.bundle_date,
            },
            userId,
          ),
        );
      }
    }

    const [cgmSummary] = await tenantDb.query(
      `
        SELECT *
        FROM cgm_summary
        WHERE diabetes_registry_id = $1
        ORDER BY summary_date DESC
        LIMIT 1
      `,
      [registryId],
    );
    if (cgmSummary) {
      if (cgmSummary.time_below_range_70 && cgmSummary.time_below_range_70 > 4 && shouldCreate('hypoglycemia', 'time_below_70')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'hypoglycemia',
              alertSeverity: 'high',
              alertMessage: `Time below range exceeds 4% on ${cgmSummary.summary_date}.`,
              relatedMetric: 'time_below_70',
              relatedValue: cgmSummary.time_below_range_70,
              relatedDate: cgmSummary.summary_date,
            },
            userId,
          ),
        );
      }
      if (cgmSummary.time_above_range_180 && cgmSummary.time_above_range_180 > 25 && shouldCreate('hyperglycemia', 'time_above_180')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'hyperglycemia',
              alertSeverity: 'medium',
              alertMessage: `Time above range is ${cgmSummary.time_above_range_180}% on ${cgmSummary.summary_date}.`,
              relatedMetric: 'time_above_180',
              relatedValue: cgmSummary.time_above_range_180,
              relatedDate: cgmSummary.summary_date,
            },
            userId,
          ),
        );
      }
    }

    const [latestVitals] = await tenantDb.query(
      `
        SELECT blood_glucose, recorded_at
        FROM vitals
        WHERE patient_id = $1
          AND blood_glucose IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      `,
      [patientId],
    );
    if (latestVitals?.blood_glucose !== null) {
      // Vitals blood glucose is recorded in mmol/L (system-wide standard). Thresholds:
      // 13.9 mmol/L (~250 mg/dL) marked hyperglycaemia, 3.9 mmol/L (~70 mg/dL) hypoglycaemia.
      const glucoseValue = Number(latestVitals.blood_glucose);
      if (glucoseValue >= 13.9 && shouldCreate('abnormal_value', 'vitals_hyper')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'abnormal_value',
              alertSeverity: 'high',
              alertMessage: `Point-of-care glucose ${glucoseValue} mmol/L detected from vitals.`,
              relatedMetric: 'vitals_hyper',
              relatedValue: glucoseValue,
              relatedDate: latestVitals.recorded_at,
            },
            userId,
          ),
        );
      } else if (glucoseValue <= 3.9 && shouldCreate('abnormal_value', 'vitals_hypo')) {
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'abnormal_value',
              alertSeverity: 'critical',
              alertMessage: `Point-of-care glucose ${glucoseValue} mmol/L indicates hypoglycemia.`,
              relatedMetric: 'vitals_hypo',
              relatedValue: glucoseValue,
              relatedDate: latestVitals.recorded_at,
            },
            userId,
          ),
        );
      }
    }

    const [lowAdherence] = await tenantDb.query(
      `
        SELECT medication_name, adherence_percentage
        FROM diabetes_medications
        WHERE diabetes_registry_id = $1
          AND adherence_percentage IS NOT NULL
          AND adherence_percentage < 80
        ORDER BY adherence_percentage ASC
        LIMIT 1
      `,
      [registryId],
    );
    if (lowAdherence && shouldCreate('medication_adherence', lowAdherence.medication_name)) {
      createdAlerts.push(
        await this.diabetesService.createAlert(
          tenantDb,
          registryId,
          patientId,
          {
            alertType: 'medication_adherence',
            alertSeverity: 'medium',
            alertMessage: `${lowAdherence.medication_name} adherence at ${lowAdherence.adherence_percentage}%`,
            relatedMetric: lowAdherence.medication_name,
            relatedValue: lowAdherence.adherence_percentage,
          },
          userId,
        ),
      );
    }

    const overdueScreenings = screeningStatus.filter((item: any) => item.overdue);
    if (overdueScreenings.length) {
      for (const overdue of overdueScreenings) {
        if (!shouldCreate('overdue_screening', overdue.screeningType)) {
          continue;
        }
        createdAlerts.push(
          await this.diabetesService.createAlert(
            tenantDb,
            registryId,
            patientId,
            {
              alertType: 'overdue_screening',
              alertSeverity: 'medium',
              alertMessage: `${overdue.screeningType.replace('_', ' ')} screening is overdue.`,
              relatedMetric: overdue.screeningType,
              relatedDate: overdue.lastScreeningDate,
            },
            userId,
          ),
        );
      }
    }

    this.logger.log(`Generated ${createdAlerts.length} diabetes alerts for registry ${registryId}`);
    return createdAlerts;
  }
}


