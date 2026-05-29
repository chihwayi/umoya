import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { shouldPropagate } from '../constants/propagation-conditions';

@Injectable()
export class HouseholdRiskService {
  private readonly logger = new Logger(HouseholdRiskService.name);

  async linkPatients(
    db: DataSource,
    patientAId: string,
    patientBId: string,
    relationship: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO patient_family_links (patient_a_id, patient_b_id, relationship)
       VALUES ($1, $2, $3)
       ON CONFLICT (patient_a_id, patient_b_id) DO UPDATE SET relationship = EXCLUDED.relationship`,
      [patientAId, patientBId, relationship],
    );
    // Ensure symmetric link
    await db.query(
      `INSERT INTO patient_family_links (patient_a_id, patient_b_id, relationship)
       VALUES ($1, $2, $3)
       ON CONFLICT (patient_a_id, patient_b_id) DO UPDATE SET relationship = EXCLUDED.relationship`,
      [patientBId, patientAId, relationship],
    );
  }

  async assignHousehold(db: DataSource, patientId: string, householdId: string): Promise<void> {
    await db.query(
      `UPDATE patients SET household_id = $1 WHERE id = $2`,
      [householdId, patientId],
    );
  }

  async createHousehold(
    db: DataSource,
    address: { line1?: string; line2?: string; suburb?: string; city?: string },
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO household_groups (address_line1, address_line2, suburb, city)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [address.line1 ?? null, address.line2 ?? null, address.suburb ?? null, address.city ?? null],
    );
    return row.id;
  }

  async propagateDiagnosis(
    db: DataSource,
    patientId: string,
    conditionName: string,
  ): Promise<number> {
    const { type, severity } = shouldPropagate(conditionName);
    if (!type) return 0;

    // Get household members and family links
    const [patient] = await db.query(
      `SELECT household_id FROM patients WHERE id = $1`,
      [patientId],
    );

    let alertsCreated = 0;

    if (patient?.household_id) {
      const message = type === 'infectious_exposure'
        ? `Household contact of patient diagnosed with ${conditionName}. Screening recommended.`
        : `Family member diagnosed with ${conditionName}. Genetic risk assessment recommended.`;

      await db.query(
        `INSERT INTO household_alerts
           (household_id, source_patient_id, alert_type, condition_name, message, severity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [patient.household_id, patientId, type, conditionName, message, severity],
      );
      alertsCreated++;
    }

    this.logger.log(`Propagated ${conditionName} (${type}) from patient=${patientId}: ${alertsCreated} alerts`);
    return alertsCreated;
  }

  async getFamilyPanel(db: DataSource, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT pfl.relationship,
         p.id, p.first_name, p.last_name,
         p.latest_risk_level,
         (SELECT d.description FROM diagnoses d
          WHERE d.patient_id = p.id
          ORDER BY d.created_at DESC LIMIT 1) AS latest_diagnosis
       FROM patient_family_links pfl
       JOIN patients p ON p.id = pfl.patient_b_id
       WHERE pfl.patient_a_id = $1`,
      [patientId],
    );
  }

  async getHouseholdAlerts(db: DataSource, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT ha.*
       FROM household_alerts ha
       JOIN patients p ON p.household_id = ha.household_id
       WHERE p.id = $1 AND ha.resolved_at IS NULL
       ORDER BY ha.created_at DESC`,
      [patientId],
    );
  }

  async resolveAlert(db: DataSource, alertId: string): Promise<void> {
    await db.query(
      `UPDATE household_alerts SET resolved_at = now() WHERE id = $1`,
      [alertId],
    );
  }
}
