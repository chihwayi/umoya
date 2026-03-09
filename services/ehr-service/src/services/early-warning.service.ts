import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientEarlyWarningScore } from '../entities/patient-early-warning-score.entity';

export interface News2Input {
  patientId: string;
  admissionId?: string | null;
  vitalsId?: string | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  onSupplementalOxygen?: boolean | null;
  temperature?: number | null;
  systolicBp?: number | null;
  heartRate?: number | null;
  consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive' | 'confused' | null;
}

interface ComponentScore {
  parameter: string;
  value: number | string | null;
  score: number;
  rationale: string;
}

@Injectable()
export class EarlyWarningService {
  private scoreRespiratoryRate(rr: number | null | undefined): ComponentScore {
    if (rr == null || Number.isNaN(rr)) {
      return { parameter: 'respiratoryRate', value: null, score: 0, rationale: 'missing' };
    }
    const value = rr;
    let score = 0;
    if (value <= 8) score = 3;
    else if (value >= 9 && value <= 11) score = 1;
    else if (value >= 21 && value <= 24) score = 2;
    else if (value >= 25) score = 3;
    return {
      parameter: 'respiratoryRate',
      value,
      score,
      rationale: 'NEWS2 respiratory rate banding',
    };
  }

  private scoreSpO2(spo2: number | null | undefined, onOxygen: boolean | null | undefined): ComponentScore {
    if (spo2 == null || Number.isNaN(spo2)) {
      return { parameter: 'spo2', value: null, score: 0, rationale: 'missing' };
    }
    const value = spo2;
    let score = 0;
    if (value <= 91) score = 3;
    else if (value >= 92 && value <= 93) score = 2;
    else if (value >= 94 && value <= 95) score = 1;
    else if (value >= 96) score = 0;

    // Supplemental O2 adds 2 points in NEWS2
    if (onOxygen) {
      score += 2;
    }

    return {
      parameter: 'spo2',
      value,
      score,
      rationale: onOxygen ? 'SpO2 banding + supplemental O2 penalty' : 'SpO2 banding',
    };
  }

  private scoreTemperature(temp: number | null | undefined): ComponentScore {
    if (temp == null || Number.isNaN(temp)) {
      return { parameter: 'temperature', value: null, score: 0, rationale: 'missing' };
    }
    const value = temp;
    let score = 0;
    if (value <= 35.0) score = 3;
    else if (value >= 35.1 && value <= 36.0) score = 1;
    else if (value >= 38.1 && value <= 39.0) score = 1;
    else if (value >= 39.1) score = 2;
    return {
      parameter: 'temperature',
      value,
      score,
      rationale: 'NEWS2 temperature banding (°C)',
    };
  }

  private scoreSystolicBp(bp: number | null | undefined): ComponentScore {
    if (bp == null || Number.isNaN(bp)) {
      return { parameter: 'systolicBp', value: null, score: 0, rationale: 'missing' };
    }
    const value = bp;
    let score = 0;
    if (value <= 90) score = 3;
    else if (value >= 91 && value <= 100) score = 2;
    else if (value >= 101 && value <= 110) score = 1;
    else if (value >= 111 && value <= 219) score = 0;
    else if (value >= 220) score = 3;
    return {
      parameter: 'systolicBp',
      value,
      score,
      rationale: 'NEWS2 systolic BP banding (mmHg)',
    };
  }

  private scoreHeartRate(hr: number | null | undefined): ComponentScore {
    if (hr == null || Number.isNaN(hr)) {
      return { parameter: 'heartRate', value: null, score: 0, rationale: 'missing' };
    }
    const value = hr;
    let score = 0;
    if (value <= 40) score = 3;
    else if (value >= 41 && value <= 50) score = 1;
    else if (value >= 51 && value <= 90) score = 0;
    else if (value >= 91 && value <= 110) score = 1;
    else if (value >= 111 && value <= 130) score = 2;
    else if (value >= 131) score = 3;
    return {
      parameter: 'heartRate',
      value,
      score,
      rationale: 'NEWS2 heart rate banding (bpm)',
    };
  }

  private scoreConsciousness(level: News2Input['consciousness']): ComponentScore {
    const value = level || 'alert';
    const abnormal = value !== 'alert';
    return {
      parameter: 'consciousness',
      value,
      score: abnormal ? 3 : 0,
      rationale: abnormal ? 'NEWS2 AVPU: non-alert' : 'NEWS2 AVPU: alert',
    };
  }

  private deriveRiskLevel(total: number, components: ComponentScore[]): 'low' | 'low_medium' | 'medium' | 'high' {
    const maxComponent = components.reduce((max, c) => (c.score > max ? c.score : max), 0);
    if (total >= 7) return 'high';
    if (total >= 5 || maxComponent === 3) return 'medium';
    if (total >= 1) return 'low_medium';
    return 'low';
  }

  calculateNews2(input: News2Input) {
    const components: ComponentScore[] = [];
    components.push(this.scoreRespiratoryRate(input.respiratoryRate ?? null));
    components.push(this.scoreSpO2(input.spo2 ?? null, input.onSupplementalOxygen ?? false));
    components.push(this.scoreTemperature(input.temperature ?? null));
    components.push(this.scoreSystolicBp(input.systolicBp ?? null));
    components.push(this.scoreHeartRate(input.heartRate ?? null));
    components.push(this.scoreConsciousness(input.consciousness ?? 'alert'));

    const totalScore = components.reduce((sum, c) => sum + (c.score || 0), 0);
    const riskLevel = this.deriveRiskLevel(totalScore, components);
    const alertTriggered = totalScore >= 5 || components.some((c) => c.score === 3);

    return {
      totalScore,
      riskLevel,
      alertTriggered,
      components,
    };
  }

  async recordNews2Score(tenantDb: DataSource, payload: News2Input) {
    if (!payload.patientId) throw new BadRequestException('patientId is required');
    const calc = this.calculateNews2(payload);

    const repo = tenantDb.getRepository(PatientEarlyWarningScore);
    const row = repo.create({
      patientId: payload.patientId,
      admissionId: payload.admissionId ?? null,
      scoreType: 'NEWS2',
      totalScore: calc.totalScore,
      riskLevel: calc.riskLevel,
      componentScores: {
        components: calc.components,
        input: payload,
      },
      vitalsId: payload.vitalsId ?? null,
      calculatedAt: new Date(),
      alertTriggered: calc.alertTriggered,
      alertAcknowledgedBy: null,
      alertAcknowledgedAt: null,
    });

    const saved = await repo.save(row);
    return saved;
  }

  async listScoresForPatient(tenantDb: DataSource, patientId: string, limit = 50) {
    if (!patientId) throw new BadRequestException('patientId is required');
    return await tenantDb
      .getRepository(PatientEarlyWarningScore)
      .createQueryBuilder('s')
      .where('s.patientId = :patientId', { patientId })
      .orderBy('s.calculatedAt', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 500))
      .getMany();
  }

  async listActiveAlerts(tenantDb: DataSource, limit = 50) {
    return await tenantDb
      .getRepository(PatientEarlyWarningScore)
      .createQueryBuilder('s')
      .where('s.alertTriggered = true')
      .andWhere('s.alertAcknowledgedAt IS NULL')
      .orderBy('s.calculatedAt', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 500))
      .getMany();
  }

  async acknowledgeAlert(tenantDb: DataSource, id: string, userId: string | null) {
    const repo = tenantDb.getRepository(PatientEarlyWarningScore);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new BadRequestException('Score not found');
    row.alertAcknowledgedAt = new Date();
    row.alertAcknowledgedBy = userId ?? null;
    return await repo.save(row);
  }
}

