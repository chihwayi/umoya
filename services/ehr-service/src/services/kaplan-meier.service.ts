import { Injectable } from '@nestjs/common';

export interface SurvivalEvent {
  time: number;
  event: boolean;
}

export interface KmPoint {
  time: number;
  survivalProbability: number;
  atRisk: number;
  events: number;
  censored: number;
  lowerCI: number;
  upperCI: number;
}

@Injectable()
export class KaplanMeierService {
  compute(events: SurvivalEvent[]): KmPoint[] {
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const uniqueTimes = [...new Set(sorted.map(e => e.time))].sort((a, b) => a - b);

    let survivalProb = 1.0;
    let greenwood = 0.0;
    const points: KmPoint[] = [];
    let remaining = sorted.length;

    for (const t of uniqueTimes) {
      const atT = sorted.filter(e => e.time === t);
      const eventCount    = atT.filter(e => e.event).length;
      const censoredCount = atT.filter(e => !e.event).length;
      const atRisk = remaining;

      if (eventCount > 0) {
        survivalProb *= (atRisk - eventCount) / atRisk;
        greenwood += eventCount / (atRisk * (atRisk - eventCount));
      }

      const se   = survivalProb * Math.sqrt(greenwood);
      const z95  = 1.96;

      points.push({
        time: t,
        survivalProbability: Math.round(survivalProb * 1000) / 1000,
        atRisk,
        events:   eventCount,
        censored: censoredCount,
        lowerCI:  Math.max(0, Math.round((survivalProb - z95 * se) * 1000) / 1000),
        upperCI:  Math.min(1, Math.round((survivalProb + z95 * se) * 1000) / 1000),
      });

      remaining -= atT.length;
    }

    return points;
  }

  medianSurvival(points: KmPoint[]): number | null {
    const p = points.find(pt => pt.survivalProbability <= 0.5);
    return p ? p.time : null;
  }

  async computeFromDb(params: {
    eventType: 'ltfu' | 'treatment_failure';
    cohortStart: string;
    db: any;
  }): Promise<{ points: KmPoint[]; medianTime: number | null }> {
    let query = '';

    if (params.eventType === 'ltfu') {
      query = `
        SELECT
          EXTRACT(DAY FROM (COALESCE(
            (SELECT MAX(visit_date) FROM hiv_clinical_visits v WHERE v.patient_id = e.patient_id),
            CURRENT_DATE
          ) - e.art_start_date)) AS time_days,
          (e.art_status NOT IN ('on_art', 'transferred_out')) AS event_occurred
        FROM hiv_enrollments e
        WHERE e.art_start_date >= $1::DATE AND e.art_start_date < $1::DATE + INTERVAL '1 year'
      `;
    } else {
      query = `
        SELECT
          EXTRACT(DAY FROM (COALESCE(
            (SELECT MIN(cv.visit_date) FROM hiv_clinical_visits cv
             WHERE cv.patient_id = e.patient_id AND cv.viral_load >= 1000
             AND cv.visit_date >= e.art_start_date),
            CURRENT_DATE
          ) - e.art_start_date)) AS time_days,
          EXISTS (
            SELECT 1 FROM hiv_clinical_visits cv
            WHERE cv.patient_id = e.patient_id AND cv.viral_load >= 1000
          ) AS event_occurred
        FROM hiv_enrollments e
        WHERE e.art_start_date >= $1::DATE AND e.art_start_date < $1::DATE + INTERVAL '1 year'
      `;
    }

    const rows = await params.db.query(query, [params.cohortStart]);
    const events: SurvivalEvent[] = rows.map((r: any) => ({
      time: Math.round(parseInt(r.time_days) / 30),
      event: r.event_occurred,
    }));

    const points = this.compute(events);
    return { points, medianTime: this.medianSurvival(points) };
  }
}
