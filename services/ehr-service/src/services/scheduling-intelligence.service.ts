import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface NoShowPrediction {
  id: string;
  appointmentId: string;
  patientId: string;
  noShowProbability: number;
  riskFactors: RiskFactor[];
  suggestedAction: string | null;
  modelVersion: string;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface SmartSlot {
  slotStart: string;
  slotEnd: string;
  doctorId: string;
  doctorName: string;
  score: number;
  reasons: string[];
}

@Injectable()
export class SchedulingIntelligenceService {
  private readonly logger = new Logger(SchedulingIntelligenceService.name);
  private readonly MODEL_VERSION = 'rule_v1';

  async predictNoShow(
    tenantDb: DataSource,
    appointmentId: string,
    patientId: string,
  ): Promise<NoShowPrediction> {
    const [historyRows, appointmentRows] = await Promise.all([
      tenantDb.query(
        `SELECT status, appointment_date FROM appointments
         WHERE patient_id = $1 AND appointment_date < NOW()
         ORDER BY appointment_date DESC LIMIT 20`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT appointment_date, appointment_type, doctor_id, duration_minutes, created_at
         FROM appointments WHERE id = $1 LIMIT 1`,
        [appointmentId],
      ),
    ]);

    const appt = appointmentRows?.[0];
    const riskFactors: RiskFactor[] = [];
    let score = 0;

    if (historyRows?.length) {
      const totalPast = historyRows.length;
      const noShows = historyRows.filter((r: any) => r.status === 'no_show').length;
      const cancellations = historyRows.filter((r: any) => r.status === 'cancelled').length;
      const noShowRate = totalPast > 0 ? noShows / totalPast : 0;
      const cancelRate = totalPast > 0 ? cancellations / totalPast : 0;

      if (noShowRate > 0.3) {
        const w = Math.min(0.35, noShowRate * 0.5);
        score += w;
        riskFactors.push({ factor: 'high_historical_no_show', weight: w, detail: `${Math.round(noShowRate * 100)}% historical no-show rate (${noShows}/${totalPast})` });
      } else if (noShowRate > 0.1) {
        const w = noShowRate * 0.3;
        score += w;
        riskFactors.push({ factor: 'moderate_historical_no_show', weight: w, detail: `${Math.round(noShowRate * 100)}% historical no-show rate` });
      }

      if (cancelRate > 0.3) {
        const w = 0.1;
        score += w;
        riskFactors.push({ factor: 'high_cancellation_rate', weight: w, detail: `${Math.round(cancelRate * 100)}% cancellation rate` });
      }
    } else {
      score += 0.15;
      riskFactors.push({ factor: 'new_patient', weight: 0.15, detail: 'No appointment history — new patients have higher no-show rates' });
    }

    if (appt) {
      const apptDate = new Date(appt.appointment_date);
      const createdDate = new Date(appt.created_at);
      const leadDays = Math.floor((apptDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      if (leadDays > 30) {
        const w = 0.12;
        score += w;
        riskFactors.push({ factor: 'long_lead_time', weight: w, detail: `${leadDays}-day lead time; appointments booked far out have higher no-show` });
      } else if (leadDays > 14) {
        const w = 0.06;
        score += w;
        riskFactors.push({ factor: 'moderate_lead_time', weight: w, detail: `${leadDays}-day lead time` });
      }

      const dayOfWeek = apptDate.getDay();
      if (dayOfWeek === 1) {
        const w = 0.05;
        score += w;
        riskFactors.push({ factor: 'monday_appointment', weight: w, detail: 'Monday appointments have slightly higher no-show rates' });
      }

      const hour = apptDate.getHours();
      if (hour >= 16) {
        const w = 0.04;
        score += w;
        riskFactors.push({ factor: 'late_afternoon', weight: w, detail: 'Late afternoon slots tend to have higher no-show rates' });
      }
    }

    const probability = Math.min(0.95, Math.max(0.02, score));
    const suggestedAction = this.deriveSuggestedAction(probability);

    const insertResult = await tenantDb.query(
      `INSERT INTO appointment_no_show_predictions
        (appointment_id, patient_id, no_show_probability, risk_factors, suggested_action, model_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [appointmentId, patientId, probability, JSON.stringify(riskFactors), suggestedAction, this.MODEL_VERSION],
    );

    return {
      id: insertResult[0].id,
      appointmentId,
      patientId,
      noShowProbability: probability,
      riskFactors,
      suggestedAction,
      modelVersion: this.MODEL_VERSION,
    };
  }

  async getPredictionForAppointment(
    tenantDb: DataSource,
    appointmentId: string,
  ): Promise<NoShowPrediction | null> {
    const rows = await tenantDb.query(
      `SELECT * FROM appointment_no_show_predictions WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [appointmentId],
    );
    if (!rows?.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      appointmentId: r.appointment_id,
      patientId: r.patient_id,
      noShowProbability: r.no_show_probability,
      riskFactors: typeof r.risk_factors === 'string' ? JSON.parse(r.risk_factors) : r.risk_factors,
      suggestedAction: r.suggested_action,
      modelVersion: r.model_version,
    };
  }

  async getHighRiskToday(tenantDb: DataSource, threshold = 0.4): Promise<any[]> {
    const rows = await tenantDb.query(
      `SELECT p.*, a.appointment_date, a.appointment_type, a.status as appt_status,
              pt.first_name, pt.last_name, pt.patient_number
       FROM appointment_no_show_predictions p
       JOIN appointments a ON a.id = p.appointment_id
       JOIN patients pt ON pt.id = p.patient_id
       WHERE a.appointment_date::date = CURRENT_DATE
         AND a.status NOT IN ('completed', 'cancelled', 'no_show', 'checked_in')
         AND p.no_show_probability >= $1
       ORDER BY p.no_show_probability DESC`,
      [threshold],
    );
    return rows;
  }

  async getSmartSlotSuggestions(
    tenantDb: DataSource,
    patientId: string,
    visitType: string | null,
    preferredDoctorId: string | null,
  ): Promise<SmartSlot[]> {
    const historyRows = await tenantDb.query(
      `SELECT EXTRACT(DOW FROM appointment_date) as dow,
              EXTRACT(HOUR FROM appointment_date) as hour,
              status
       FROM appointments
       WHERE patient_id = $1 AND appointment_date > NOW() - INTERVAL '1 year'
       ORDER BY appointment_date DESC LIMIT 20`,
      [patientId],
    );

    const completedVisits = historyRows.filter((r: any) => r.status === 'completed');
    const preferredDow = this.mode(completedVisits.map((r: any) => Number(r.dow)));
    const preferredHour = this.mode(completedVisits.map((r: any) => Number(r.hour)));

    let doctorFilter = '';
    const params: any[] = [];
    let paramIdx = 1;

    if (preferredDoctorId) {
      doctorFilter = `AND da.doctor_id = $${paramIdx++}`;
      params.push(preferredDoctorId);
    }

    const availRows = await tenantDb.query(
      `SELECT da.doctor_id, da.day_of_week, da.start_time, da.end_time,
              u.first_name, u.last_name
       FROM doctor_availability da
       JOIN users u ON u.id = da.doctor_id
       WHERE da.is_available = true ${doctorFilter}
       ORDER BY da.day_of_week, da.start_time
       LIMIT 50`,
      params,
    );

    const slots: SmartSlot[] = [];
    const now = new Date();

    for (const avail of availRows) {
      const dow = avail.day_of_week;
      const startHour = parseInt(String(avail.start_time).split(':')[0], 10);
      const endHour = parseInt(String(avail.end_time).split(':')[0], 10);

      for (let h = startHour; h < endHour; h++) {
        const reasons: string[] = [];
        let slotScore = 50;

        if (dow === preferredDow) {
          slotScore += 20;
          reasons.push('Matches patient preferred day');
        }
        if (h === preferredHour) {
          slotScore += 15;
          reasons.push('Matches patient preferred time');
        }
        if (h >= 9 && h <= 11) {
          slotScore += 5;
          reasons.push('Morning slot — lower no-show rate');
        }

        const nextDate = this.nextWeekday(now, dow);
        const slotStart = new Date(nextDate);
        slotStart.setHours(h, 0, 0, 0);

        if (slotStart <= now) continue;

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

        slots.push({
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          doctorId: avail.doctor_id,
          doctorName: `Dr. ${avail.first_name} ${avail.last_name}`,
          score: slotScore,
          reasons,
        });
      }
    }

    return slots.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private deriveSuggestedAction(probability: number): string | null {
    if (probability >= 0.6) return 'call_patient';
    if (probability >= 0.4) return 'send_extra_reminder';
    if (probability >= 0.25) return 'offer_telehealth';
    return null;
  }

  private mode(arr: number[]): number | null {
    if (!arr.length) return null;
    const freq: Record<number, number> = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  private nextWeekday(from: Date, dow: number): Date {
    const d = new Date(from);
    const diff = (dow - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  }
}
