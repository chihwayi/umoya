import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { AbstentionLogService } from './abstention-log.service';

const ABSTENTION_NARRATIVE =
  'Interpretation pending — please consult your clinician.';

@Injectable()
export class LabAiNarrativeService {
  private readonly logger = new Logger(LabAiNarrativeService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async generateNarrative(
    resultId: string,
    patientId: string,
    db: any,
    subdomain: string,
  ): Promise<unknown> {
    const results = await db.query(
      `SELECT lr.*, lp.name AS panel_name
       FROM lab_results lr
       LEFT JOIN lab_panels lp ON lp.id = lr.panel_id
       WHERE lr.id = $1`,
      [resultId],
    );
    const result = results[0] ?? null;
    if (!result) throw new Error(`Lab result ${resultId} not found`);

    const patients = await db.query(
      `SELECT first_name, last_name, date_of_birth, sex
       FROM patients WHERE id = $1`,
      [patientId],
    );
    const patient = patients[0] ?? {};

    const previousValues = await this.getPreviousValues(patientId, result.test_name, db);

    let clinicianNarrative = ABSTENTION_NARRATIVE;
    let patientNarrative = ABSTENTION_NARRATIVE;
    let keyFindings: unknown[] = [];
    let hasCritical = false;

    if (this.cdss) {
      try {
        const labResultPayload = {
          test_name: result.test_name ?? result.panel_name,
          value: result.value,
          unit: result.unit,
          reference_range: result.reference_range,
          flag: result.flag,
          patient_age: this.calcAge(patient.date_of_birth),
          patient_sex: patient.sex,
          historical: previousValues,
        };

        const interpretation = await this.cdss.interpretLabResults(
          [labResultPayload],
          previousValues.map((v) => ({
            test_name: result.test_name,
            value: v.value,
            resulted_at: v.resultedAt,
          })),
        );

        const firstInterp = interpretation?.interpretations?.[0];
        if (firstInterp) {
          clinicianNarrative =
            firstInterp.clinician_narrative ??
            firstInterp.interpretation ??
            ABSTENTION_NARRATIVE;
          patientNarrative =
            firstInterp.patient_narrative ??
            firstInterp.plain_language ??
            ABSTENTION_NARRATIVE;
          keyFindings = firstInterp.key_findings ?? [];
          hasCritical =
            firstInterp.is_critical ??
            (interpretation.summary?.critical ?? 0) > 0;
        }

        if ((interpretation.critical_alerts?.length ?? 0) > 0) hasCritical = true;
      } catch (err: any) {
        this.logger.warn(`CDSS lab interpretation failed: ${err.message}`);
        if (this.abstentionLog) {
          await this.abstentionLog.log(db, 'lab_interpretation', 'cdss_error', {
            patientId,
            errorDetail: err.message,
          });
        }
      }
    } else {
      if (this.abstentionLog) {
        await this.abstentionLog.log(db, 'lab_interpretation', 'not_configured', { patientId });
      }
    }

    if (['HH', 'LL', 'critical'].includes(result.flag)) hasCritical = true;

    const rows = await db.query(
      `INSERT INTO lab_ai_narratives
         (result_id, patient_id, clinician_narrative, patient_narrative,
          key_findings, has_critical_value)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (result_id) DO UPDATE SET
         clinician_narrative = EXCLUDED.clinician_narrative,
         patient_narrative = EXCLUDED.patient_narrative,
         key_findings = EXCLUDED.key_findings,
         has_critical_value = EXCLUDED.has_critical_value,
         updated_at = now()
       RETURNING *`,
      [
        resultId, patientId, clinicianNarrative, patientNarrative,
        JSON.stringify(keyFindings), hasCritical,
      ],
    );
    const record = rows[0];

    if (hasCritical && !result.alert_sent && this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'critical_lab_value',
          sourceEntityId: resultId,
          patientId,
          severity: 'critical',
          message: `Critical lab value: ${result.test_name} = ${result.value} ${result.unit ?? ''} (${result.flag})`,
          payload: { resultId, testName: result.test_name, value: result.value, flag: result.flag },
        });
        await db.query(
          `UPDATE lab_ai_narratives SET alert_sent = true WHERE id = $1`,
          [record.id],
        );
      } catch (alertErr: any) {
        this.logger.warn(`Critical lab alert failed: ${alertErr.message}`);
      }
    }

    return record;
  }

  async getNarrative(resultId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM lab_ai_narratives WHERE result_id = $1`,
      [resultId],
    );
    return rows[0] ?? null;
  }

  private calcAge(dob?: string): number | null {
    if (!dob) return null;
    const born = new Date(dob);
    const now = new Date();
    return Math.floor((now.getTime() - born.getTime()) / (365.25 * 24 * 3600 * 1000));
  }

  private async getPreviousValues(
    patientId: string,
    testName: string,
    db: any,
  ): Promise<Array<{ value: string; resultedAt: string }>> {
    const rows = await db.query(
      `SELECT value, resulted_at FROM lab_results
       WHERE patient_id = $1 AND test_name = $2 AND status = 'resulted'
       ORDER BY resulted_at DESC LIMIT 5`,
      [patientId, testName],
    );
    return rows.map((r: any) => ({ value: r.value, resultedAt: r.resulted_at }));
  }
}
