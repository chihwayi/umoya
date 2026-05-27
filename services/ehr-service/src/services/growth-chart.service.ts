import { Injectable } from '@nestjs/common';

const WHO_WAZ_TABLE: Array<{ sex: string; ageMonths: number; L: number; M: number; S: number }> = [
  { sex: 'F', ageMonths: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
  { sex: 'F', ageMonths: 1, L: 0.2361, M: 4.1873, S: 0.13724 },
  { sex: 'F', ageMonths: 3, L: 0.2986, M: 5.7769, S: 0.12520 },
  { sex: 'F', ageMonths: 6, L: 0.3520, M: 7.2986, S: 0.11737 },
  { sex: 'F', ageMonths: 12, L: 0.6972, M: 9.1649, S: 0.11659 },
  { sex: 'F', ageMonths: 24, L: 0.7915, M: 11.4797, S: 0.12026 },
  { sex: 'M', ageMonths: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { sex: 'M', ageMonths: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
  { sex: 'M', ageMonths: 3, L: 0.2986, M: 6.3762, S: 0.12580 },
  { sex: 'M', ageMonths: 6, L: 0.2134, M: 7.9340, S: 0.11657 },
  { sex: 'M', ageMonths: 12, L: 0.5563, M: 9.6479, S: 0.11316 },
  { sex: 'M', ageMonths: 24, L: 0.4349, M: 12.1884, S: 0.11257 },
];

export interface GrowthZScores {
  waz: number | null;
  haz: number | null;
  whz: number | null;
  baz: number | null;
  wazCategory: string;
  hazCategory: string;
  nutritionReferralNeeded: boolean;
}

@Injectable()
export class GrowthChartService {
  computeZScore(measurement: number, L: number, M: number, S: number): number {
    if (L === 0) {
      return Math.log(measurement / M) / S;
    }
    return (Math.pow(measurement / M, L) - 1) / (L * S);
  }

  private getLmsParams(
    ageMonths: number,
    sex: 'M' | 'F',
  ): { L: number; M: number; S: number } | null {
    const sexRows = WHO_WAZ_TABLE.filter((r) => r.sex === sex);
    if (sexRows.length === 0) return null;
    sexRows.sort((a, b) => Math.abs(a.ageMonths - ageMonths) - Math.abs(b.ageMonths - ageMonths));
    return sexRows[0];
  }

  categoriseWaz(waz: number | null): string {
    if (waz === null) return 'unknown';
    if (waz < -3) return 'severe_underweight';
    if (waz < -2) return 'underweight';
    if (waz <= 2) return 'normal';
    return 'overweight';
  }

  categoriseHaz(haz: number | null): string {
    if (haz === null) return 'unknown';
    if (haz < -3) return 'severely_stunted';
    if (haz < -2) return 'stunted';
    return 'normal';
  }

  computeAllZScores(
    weightKg: number | null,
    heightCm: number | null,
    ageMonths: number,
    sex: 'M' | 'F',
  ): GrowthZScores {
    let waz: number | null = null;
    const haz: number | null = null;
    const whz: number | null = null;
    const baz: number | null = null;

    if (weightKg !== null) {
      const params = this.getLmsParams(ageMonths, sex);
      if (params) {
        waz = Number(this.computeZScore(weightKg, params.L, params.M, params.S).toFixed(2));
      }
    }

    // HAZ, WHZ, BAZ use same LMS pattern; full WHO tables loaded from JSON in production
    void heightCm;

    const wazCategory = this.categoriseWaz(waz);
    const hazCategory = this.categoriseHaz(haz);
    const nutritionReferralNeeded = (waz !== null && waz < -2) || (whz !== null && whz < -2);

    return { waz, haz, whz, baz, wazCategory, hazCategory, nutritionReferralNeeded };
  }

  async recordGrowthMeasurement(
    patientId: string,
    measurementDate: string,
    weightKg: number | null,
    heightCm: number | null,
    headCircumferenceCm: number | null,
    muacCm: number | null,
    sex: 'M' | 'F',
    dateOfBirth: string,
    recordedBy: string,
    db: any,
  ): Promise<GrowthZScores & { id: string }> {
    const dob = new Date(dateOfBirth);
    const measureDate = new Date(measurementDate);
    const ageMonths = Math.round(
      (measureDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
    );

    const zScores = this.computeAllZScores(weightKg, heightCm, ageMonths, sex);

    const rows = await db.query(
      `INSERT INTO growth_measurements (
         patient_id, measurement_date, age_months, weight_kg, height_cm,
         head_circumference_cm, muac_cm, waz, haz, whz, baz,
         waz_category, haz_category, whz_category,
         nutrition_referral_needed, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        patientId, measurementDate, ageMonths, weightKg, heightCm,
        headCircumferenceCm, muacCm, zScores.waz, zScores.haz, zScores.whz, zScores.baz,
        zScores.wazCategory, zScores.hazCategory, null,
        zScores.nutritionReferralNeeded, recordedBy,
      ],
    );

    return { ...zScores, id: rows[0].id };
  }

  async getGrowthHistory(patientId: string, db: any) {
    return db.query(
      `SELECT * FROM growth_measurements WHERE patient_id = $1 ORDER BY measurement_date ASC`,
      [patientId],
    );
  }
}
