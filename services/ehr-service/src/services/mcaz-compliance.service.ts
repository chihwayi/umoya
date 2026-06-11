import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * S219 — MCAZ (Medicines Control Authority of Zimbabwe) pharmacy compliance.
 *
 * Controlled-substance (dangerous drugs) register: every dispensing whose
 * prescription is flagged controlled, with the schedule, quantities, the
 * prescriber's statutory registration, and who dispensed — the record MCAZ
 * inspections ask for. Plus a CSV export of the same.
 */
@Injectable()
export class McazComplianceService {
  private registerQuery(withFilters: { from?: string; to?: string; schedule?: string }) {
    const params: any[] = [];
    const conditions: string[] = [`p.is_controlled = true`, `d.status != 'cancelled'`];

    if (withFilters.from) {
      params.push(withFilters.from);
      conditions.push(`d.dispensing_date >= $${params.length}::date`);
    }
    if (withFilters.to) {
      params.push(withFilters.to);
      conditions.push(`d.dispensing_date <= $${params.length}::date`);
    }
    if (withFilters.schedule && withFilters.schedule !== 'all') {
      params.push(withFilters.schedule);
      conditions.push(`p.controlled_schedule = $${params.length}`);
    }

    const sql = `
      SELECT d.dispensing_date,
             d.dispensing_number,
             pt.first_name AS patient_first_name,
             pt.last_name AS patient_last_name,
             pt.patient_number,
             p.medication_name,
             p.controlled_schedule,
             p.prescription_number,
             COALESCE(items.total_quantity, 0)::int AS quantity_dispensed,
             doc.first_name AS prescriber_first_name,
             doc.last_name AS prescriber_last_name,
             doc.license_number AS prescriber_license,
             doc.registration_council AS prescriber_council,
             disp.first_name AS dispenser_first_name,
             disp.last_name AS dispenser_last_name,
             disp.license_number AS dispenser_license
      FROM pharmacy_dispensings d
      JOIN prescriptions p ON p.id = d.prescription_id
      JOIN patients pt ON pt.id = d.patient_id
      LEFT JOIN users doc ON doc.id = p.doctor_id
      LEFT JOIN users disp ON disp.id = d.dispensed_by
      LEFT JOIN LATERAL (
        SELECT SUM(i.quantity_dispensed) AS total_quantity
        FROM pharmacy_dispensing_items i
        WHERE i.dispensing_id = d.id
      ) items ON true
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.dispensing_date DESC, d.dispensing_number DESC
    `;
    return { sql, params };
  }

  private mapRegisterRow(row: any) {
    return {
      dispensingDate: row.dispensing_date,
      dispensingNumber: row.dispensing_number,
      patientName: `${row.patient_first_name || ''} ${row.patient_last_name || ''}`.trim(),
      patientNumber: row.patient_number,
      medicationName: row.medication_name,
      schedule: row.controlled_schedule,
      prescriptionNumber: row.prescription_number,
      quantityDispensed: Number(row.quantity_dispensed) || 0,
      prescriberName: `${row.prescriber_first_name || ''} ${row.prescriber_last_name || ''}`.trim(),
      prescriberLicense: row.prescriber_license,
      prescriberCouncil: row.prescriber_council,
      dispenserName: `${row.dispenser_first_name || ''} ${row.dispenser_last_name || ''}`.trim(),
      dispenserLicense: row.dispenser_license,
    };
  }

  async getControlledRegister(
    tenantDb: DataSource,
    query: { from?: string; to?: string; schedule?: string } = {},
  ) {
    const { sql, params } = this.registerQuery(query);
    const rows = await tenantDb.query(sql, params);
    const entries = rows.map((row: any) => this.mapRegisterRow(row));
    return {
      entries,
      totalEntries: entries.length,
      totalQuantity: entries.reduce((sum: number, entry: any) => sum + entry.quantityDispensed, 0),
    };
  }

  async exportControlledRegisterCsv(
    tenantDb: DataSource,
    query: { from?: string; to?: string; schedule?: string } = {},
  ) {
    const { entries } = await this.getControlledRegister(tenantDb, query);

    const headers = [
      'Date', 'Dispensing No', 'Patient', 'Patient No', 'Medication', 'Schedule',
      'Prescription No', 'Quantity', 'Prescriber', 'Prescriber Reg No', 'Council',
      'Dispensed By', 'Dispenser Reg No',
    ];
    const esc = (value: any) => {
      const s = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const entry of entries) {
      lines.push([
        entry.dispensingDate, entry.dispensingNumber, entry.patientName, entry.patientNumber,
        entry.medicationName, entry.schedule, entry.prescriptionNumber, entry.quantityDispensed,
        entry.prescriberName, entry.prescriberLicense, entry.prescriberCouncil,
        entry.dispenserName, entry.dispenserLicense,
      ].map(esc).join(','));
    }

    return {
      filename: `mcaz-controlled-register-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: lines.join('\n'),
      rowCount: entries.length,
    };
  }
}
