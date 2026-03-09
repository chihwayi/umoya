import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientService } from './patient.service';

interface MedicationInput {
  name?: string;
  genericName?: string;
  medication_name_snomed?: string;
}

export interface MedicationPregnancyAlert {
  medication: string;
  severity: 'major' | 'moderate';
  rationale: string;
}

export interface MedicationRenalDoseAlert {
  medication: string;
  severity: 'major' | 'moderate';
  rationale: string;
  egfr: number;
}

export interface MedicationHepaticDoseAlert {
  medication: string;
  severity: 'major' | 'moderate';
  rationale: string;
}

export interface MedicationSafetyAssessment {
  pregnancy: {
    isPregnant: boolean;
    riskCategory?: string | null;
    alerts: MedicationPregnancyAlert[];
  };
  renal: {
    egfr: number | null;
    alerts: MedicationRenalDoseAlert[];
  };
  hepatic: {
    suspectedImpairment: boolean;
    rationale: string | null;
    alerts: MedicationHepaticDoseAlert[];
  };
}

@Injectable()
export class MedicationSafetyService {
  constructor(private readonly patientService: PatientService) {}

  private normalizeMedicationName(med: MedicationInput): string {
    const raw =
      med.genericName ||
      med.name ||
      med.medication_name_snomed ||
      '';
    return String(raw || '').toLowerCase().trim();
  }

  private derivePregnancyAlerts(
    isPregnant: boolean,
    medications: MedicationInput[],
  ): MedicationPregnancyAlert[] {
    if (!isPregnant) return [];
    const teratogenicCatalog: Array<{ token: string; severity: 'major' | 'moderate'; rationale: string }> = [
      {
        token: 'isotretinoin',
        severity: 'major',
        rationale: 'Isotretinoin is highly teratogenic and generally contraindicated in pregnancy.',
      },
      {
        token: 'valpro',
        severity: 'major',
        rationale: 'Valproate is associated with neural tube and other congenital defects in pregnancy.',
      },
      {
        token: 'warfarin',
        severity: 'major',
        rationale: 'Warfarin crosses the placenta and is associated with fetal bleeding and malformations.',
      },
      {
        token: 'ace inhibitor',
        severity: 'moderate',
        rationale: 'ACE inhibitors in later pregnancy are associated with fetal renal impairment and oligohydramnios.',
      },
      {
        token: 'acei',
        severity: 'moderate',
        rationale: 'ACE inhibitors in later pregnancy are associated with fetal renal impairment and oligohydramnios.',
      },
      {
        token: 'arb',
        severity: 'moderate',
        rationale: 'ARBs in later pregnancy are associated with fetal renal impairment and oligohydramnios.',
      },
      {
        token: 'losartan',
        severity: 'moderate',
        rationale: 'Losartan is an ARB; review risk/benefit and consider alternatives during pregnancy.',
      },
      {
        token: 'lisinopril',
        severity: 'moderate',
        rationale: 'Lisinopril is an ACE inhibitor; avoid or use with specialist guidance in pregnancy.',
      },
    ];

    const normalized = medications.map((m) => this.normalizeMedicationName(m));
    const alerts: MedicationPregnancyAlert[] = [];

    for (const entry of teratogenicCatalog) {
      const hit = normalized.some((name) => name.includes(entry.token));
      if (!hit) continue;
      alerts.push({
        medication: entry.token,
        severity: entry.severity,
        rationale: entry.rationale,
      });
    }

    return alerts;
  }

  private async deriveEgfr(tenantDb: DataSource, patientId: string): Promise<number | null> {
    const rows = await tenantDb.query(
      `
        SELECT result_value
        FROM lab_results
        WHERE patient_id = $1
          AND status = 'completed'
          AND LOWER(test_name) LIKE '%egfr%'
        ORDER BY COALESCE(completed_at, ordered_at) DESC NULLS LAST
        LIMIT 1
      `,
      [patientId],
    );
    if (!rows || !rows[0]?.result_value) return null;
    const value = parseFloat(String(rows[0].result_value).replace(/[^\d.-]+/g, ''));
    if (!Number.isFinite(value)) return null;
    return value;
  }

  private deriveRenalAlerts(egfr: number | null, medications: MedicationInput[]): MedicationRenalDoseAlert[] {
    if (egfr === null) return [];
    const normalizedNames = medications.map((m) => this.normalizeMedicationName(m));
    const hasMed = (token: string) => normalizedNames.some((name) => name.includes(token));

    const alerts: MedicationRenalDoseAlert[] = [];
    const push = (medicationToken: string, severity: 'major' | 'moderate', rationale: string) => {
      if (!hasMed(medicationToken)) return;
      alerts.push({ medication: medicationToken, severity, rationale, egfr });
    };

    if (egfr < 30) {
      push(
        'metformin',
        'major',
        'Metformin should generally be avoided when eGFR is below 30 mL/min due to lactic acidosis risk.',
      );
      push(
        'nitrofurantoin',
        'major',
        'Nitrofurantoin efficacy and safety are reduced in severe renal impairment (eGFR < 30 mL/min).',
      );
      push(
        'enoxaparin',
        'major',
        'Enoxaparin dosing requires major adjustment when eGFR is below 30 mL/min.',
      );
    } else if (egfr < 45) {
      push(
        'metformin',
        'moderate',
        'Metformin dose reduction and closer monitoring are recommended when eGFR < 45 mL/min.',
      );
    }
    if (egfr < 60) {
      push(
        'gabapentin',
        'moderate',
        'Gabapentin dose review is recommended when eGFR < 60 mL/min.',
      );
    }
    if (egfr < 50) {
      push(
        'rivaroxaban',
        'major',
        'Rivaroxaban renal dose review is required when eGFR < 50 mL/min.',
      );
    }

    return alerts;
  }

  private async deriveHepaticFlags(
    tenantDb: DataSource,
    patientId: string,
    medications: MedicationInput[],
  ): Promise<{ suspectedImpairment: boolean; rationale: string | null; alerts: MedicationHepaticDoseAlert[] }> {
    const rows = await tenantDb.query(
      `
        SELECT test_name, result_value
        FROM lab_results
        WHERE patient_id = $1
          AND status = 'completed'
          AND (
            LOWER(test_name) LIKE '%alt%' OR
            LOWER(test_name) LIKE '%ast%' OR
            LOWER(test_name) LIKE '%bilirubin%'
          )
        ORDER BY COALESCE(completed_at, ordered_at) DESC NULLS LAST
        LIMIT 5
      `,
      [patientId],
    );

    let suspectedImpairment = false;
    let rationale: string | null = null;
    for (const row of rows || []) {
      const name = String(row.test_name || '').toLowerCase();
      const raw = String(row.result_value || '');
      const value = parseFloat(raw.replace(/[^\d.-]+/g, ''));
      if (!Number.isFinite(value)) continue;
      if ((name.includes('alt') || name.includes('ast')) && value > 80) {
        suspectedImpairment = true;
        rationale = 'Recent ALT/AST results are elevated; consider hepatic impairment when dosing medications.';
        break;
      }
      if (name.includes('bilirubin') && value > 2) {
        suspectedImpairment = true;
        rationale = 'Recent bilirubin is elevated; consider hepatic impairment when dosing medications.';
        break;
      }
    }

    const alerts: MedicationHepaticDoseAlert[] = [];
    if (suspectedImpairment) {
      const normalizedNames = medications.map((m) => this.normalizeMedicationName(m));
      const hasMed = (token: string) => normalizedNames.some((name) => name.includes(token));

      const push = (token: string, severity: 'major' | 'moderate', note: string) => {
        if (!hasMed(token)) return;
        alerts.push({
          medication: token,
          severity,
          rationale: note,
        });
      };

      push(
        'paracetamol',
        'major',
        'Maximum paracetamol daily dose should be reduced in hepatic impairment; avoid chronic high-dose use.',
      );
      push(
        'acetaminophen',
        'major',
        'Maximum acetaminophen daily dose should be reduced in hepatic impairment; avoid chronic high-dose use.',
      );
      push(
        'statin',
        'moderate',
        'Statin therapy may require closer monitoring or dose adjustment in hepatic impairment.',
      );
      push(
        'atorvastatin',
        'moderate',
        'Atorvastatin dose and monitoring should be reviewed in hepatic impairment.',
      );
    }

    return { suspectedImpairment, rationale, alerts };
  }

  async assessMedicationSafety(
    tenantDb: DataSource,
    patientId: string,
    medications: MedicationInput[],
  ): Promise<MedicationSafetyAssessment> {
    const context = await this.patientService.getPatientContext(patientId, tenantDb);
    const maternity = context?.modules?.maternity?.latestEnrollment || null;
    const isPregnant =
      Boolean(maternity?.enrollment_status === 'active') ||
      Boolean(maternity?.expected_delivery_date || maternity?.lmp_date);
    const riskCategory = maternity?.risk_category || null;

    const pregnancyAlerts = this.derivePregnancyAlerts(isPregnant, medications);

    const [egfr, hepatic] = await Promise.all([
      this.deriveEgfr(tenantDb, patientId),
      this.deriveHepaticFlags(tenantDb, patientId, medications),
    ]);
    const renalAlerts = this.deriveRenalAlerts(egfr, medications);

    return {
      pregnancy: {
        isPregnant,
        riskCategory,
        alerts: pregnancyAlerts,
      },
      renal: {
        egfr,
        alerts: renalAlerts,
      },
      hepatic: hepatic,
    };
  }
}

