import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

interface DetectedPattern {
  type: 'recurring_infection' | 'drug_failure' | 'deteriorating_vitals' | 'missed_appointments' | 'chronic_progression';
  description: string;
  severity: 'low' | 'medium' | 'high';
  occurrences: number;
  lastSeen: string;
}

@Injectable()
export class ClinicalTimelineService {
  private readonly logger = new Logger(ClinicalTimelineService.name);

  async generateTimeline(patientId: string, db: any): Promise<unknown> {
    const [demographics, diagnoses, labHistory, medications, encounters, vitals] = await Promise.all([
      db.query(`SELECT first_name, last_name, date_of_birth, sex FROM patients WHERE id = $1`, [patientId]),
      db.query(
        `SELECT icd10_code, description, status, diagnosed_at FROM patient_diagnoses
         WHERE patient_id = $1 ORDER BY diagnosed_at ASC`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, value, unit, flag, resulted_at FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted'
         ORDER BY resulted_at ASC`,
        [patientId],
      ),
      db.query(
        `SELECT drug_name, dose, frequency, start_date, end_date, status, discontinuation_reason
         FROM prescriptions WHERE patient_id = $1 ORDER BY start_date ASC`,
        [patientId],
      ),
      db.query(
        `SELECT encounter_type, chief_complaint, created_at FROM encounters
         WHERE patient_id = $1 ORDER BY created_at ASC LIMIT 20`,
        [patientId],
      ),
      db.query(
        `SELECT systolic_bp, diastolic_bp, heart_rate, temperature, recorded_at
         FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 30`,
        [patientId],
      ),
    ]);

    const patient = demographics[0] ?? {};

    const dataKey = JSON.stringify({ diagnoses: diagnoses.length, labs: labHistory.length, meds: medications.length });
    const dataHash = createHash('md5').update(dataKey).digest('hex');

    const existing = await db.query(
      `SELECT data_hash, full_narrative, one_line_summary, generated_at
       FROM patient_ai_timeline WHERE patient_id = $1`,
      [patientId],
    );
    if (existing.length > 0 && existing[0].data_hash === dataHash) {
      return existing[0];
    }

    const patterns = this.detectPatterns(diagnoses, labHistory, medications, encounters);
    const fullNarrative = this.buildRawNarrative(patient, diagnoses, labHistory, medications, patterns);

    const chronicConditions = diagnoses
      .filter((d: any) => d.status === 'chronic')
      .map((d: any) => d.description)
      .slice(0, 2)
      .join(', ');
    const oneLineSummary = `${patient.first_name ?? 'Patient'} — ${chronicConditions || 'no active chronic conditions'}`;

    const rows = await db.query(
      `INSERT INTO patient_ai_timeline
         (patient_id, one_line_summary, full_narrative, detected_patterns, data_hash)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (patient_id) DO UPDATE SET
         one_line_summary = EXCLUDED.one_line_summary,
         full_narrative = EXCLUDED.full_narrative,
         detected_patterns = EXCLUDED.detected_patterns,
         data_hash = EXCLUDED.data_hash,
         generated_at = now()
       RETURNING *`,
      [patientId, oneLineSummary, fullNarrative, JSON.stringify(patterns), dataHash],
    );
    return rows[0];
  }

  detectPatterns(
    diagnoses: any[],
    labs: any[],
    meds: any[],
    _encounters: any[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    const infectionCodes = diagnoses.filter((d) => /^[AB]/.test(d.icd10_code ?? ''));
    if (infectionCodes.length >= 3) {
      patterns.push({
        type: 'recurring_infection',
        description: `${infectionCodes.length} infectious episodes documented`,
        severity: infectionCodes.length >= 5 ? 'high' : 'medium',
        occurrences: infectionCodes.length,
        lastSeen: infectionCodes[infectionCodes.length - 1]?.diagnosed_at ?? '',
      });
    }

    const drugFailures = meds.filter((m) =>
      /failure|ineffective|resistant|not working/i.test(m.discontinuation_reason ?? ''),
    );
    if (drugFailures.length > 0) {
      patterns.push({
        type: 'drug_failure',
        description: `${drugFailures.length} medication(s) discontinued due to treatment failure: ${drugFailures.map((m: any) => m.drug_name).join(', ')}`,
        severity: drugFailures.length >= 2 ? 'high' : 'medium',
        occurrences: drugFailures.length,
        lastSeen: drugFailures[drugFailures.length - 1]?.end_date ?? '',
      });
    }

    const bpReadings = labs
      .filter((l) => l.test_name?.toLowerCase().includes('systolic'))
      .slice(-5)
      .map((l) => parseFloat(l.value));
    if (bpReadings.length >= 3) {
      const trending = bpReadings.every((v, i) => i === 0 || v >= bpReadings[i - 1]);
      if (trending && bpReadings[bpReadings.length - 1] > 140) {
        patterns.push({
          type: 'deteriorating_vitals',
          description: 'Systolic blood pressure trending upward — last reading above 140 mmHg',
          severity: 'high',
          occurrences: bpReadings.length,
          lastSeen: new Date().toISOString(),
        });
      }
    }

    return patterns;
  }

  private buildRawNarrative(
    patient: any,
    diagnoses: any[],
    labs: any[],
    meds: any[],
    patterns: DetectedPattern[],
  ): string {
    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : '?';

    const lines = [
      'PATIENT CLINICAL NARRATIVE',
      `${patient.first_name ?? 'Unknown'} ${patient.last_name ?? ''}, ${age}y ${patient.sex ?? ''}`,
      '',
      'DIAGNOSIS HISTORY:',
      ...diagnoses.slice(0, 10).map((d) =>
        `  • ${d.diagnosed_at?.toString().slice(0, 10) ?? '?'} — ${d.icd10_code} ${d.description} (${d.status})`),
      '',
      'ACTIVE MEDICATIONS:',
      ...meds.filter((m) => m.status === 'active').map((m) =>
        `  • ${m.drug_name} ${m.dose} ${m.frequency}`),
      '',
      'RECENT LAB TRENDS (last 5):',
      ...labs.slice(-5).map((l) =>
        `  • ${l.resulted_at?.toString().slice(0, 10)} — ${l.test_name}: ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`),
    ];

    if (patterns.length > 0) {
      lines.push('', 'DETECTED PATTERNS:');
      patterns.forEach((p) => lines.push(`  ⚠ ${p.description} (${p.severity})`));
    }

    return lines.filter((l) => l !== undefined).join('\n');
  }

  async getTimeline(patientId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM patient_ai_timeline WHERE patient_id = $1`,
      [patientId],
    );
    return rows[0] ?? null;
  }
}
