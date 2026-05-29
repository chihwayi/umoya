import { Injectable, BadRequestException, Optional, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientEarlyWarningScore } from '../entities/patient-early-warning-score.entity';
import { PatientVitalBaseline } from '../entities/patient-vital-baseline.entity';
import { ClinicalEscalationTask } from '../entities/clinical-escalation-task.entity';
import { NurseTask } from '../entities/nurse-task.entity';
import { NurseTaskService } from './nurse-task.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { TenantService } from './tenant.service';

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

interface BaselineComparison {
  metric: string;
  currentValue: number;
  baselineValue: number;
  lowerBound: number | null;
  upperBound: number | null;
  delta: number;
  percentDelta: number | null;
  outsideExpectedRange: boolean;
}

@Injectable()
export class EarlyWarningService {
  private readonly logger = new Logger(EarlyWarningService.name);

  constructor(
    private readonly alertDeliveryService: AlertDeliveryService,
    private readonly tenantService: TenantService,
    @Optional() private readonly nurseTaskService?: NurseTaskService,
  ) {}

  private readonly baselineMetricMap: Array<{ metric: string; payloadKey: keyof News2Input }> = [
    { metric: 'respiratoryRate', payloadKey: 'respiratoryRate' },
    { metric: 'spo2', payloadKey: 'spo2' },
    { metric: 'temperature', payloadKey: 'temperature' },
    { metric: 'systolicBp', payloadKey: 'systolicBp' },
    { metric: 'heartRate', payloadKey: 'heartRate' },
  ];

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

  private async getBaselineComparisons(tenantDb: DataSource, payload: News2Input): Promise<BaselineComparison[]> {
    const currentMetrics = this.baselineMetricMap
      .map(({ metric, payloadKey }) => ({
        metric,
        currentValue: payload[payloadKey],
      }))
      .filter((item): item is { metric: string; currentValue: number } => item.currentValue != null && !Number.isNaN(Number(item.currentValue)))
      .map((item) => ({ ...item, currentValue: Number(item.currentValue) }));

    if (currentMetrics.length === 0) {
      return [];
    }

    const baselineRows = await tenantDb.getRepository(PatientVitalBaseline).find({
      where: { patientId: payload.patientId },
    });

    return currentMetrics
      .map((item) => {
        const baseline = baselineRows.find((row) => row.metricName === item.metric);
        if (!baseline || baseline.sampleCount < 3 || baseline.baselineValue == null) {
          return null;
        }

        const baselineValue = Number(baseline.baselineValue);
        const lowerBound = baseline.lowerBound == null ? null : Number(baseline.lowerBound);
        const upperBound = baseline.upperBound == null ? null : Number(baseline.upperBound);
        const delta = Number((item.currentValue - baselineValue).toFixed(2));
        const percentDelta = baselineValue === 0 ? null : Number((((item.currentValue - baselineValue) / baselineValue) * 100).toFixed(2));
        const outsideExpectedRange =
          (lowerBound != null && item.currentValue < lowerBound) ||
          (upperBound != null && item.currentValue > upperBound);

        return {
          metric: item.metric,
          currentValue: item.currentValue,
          baselineValue,
          lowerBound,
          upperBound,
          delta,
          percentDelta,
          outsideExpectedRange,
        };
      })
      .filter((item): item is BaselineComparison => Boolean(item));
  }

  private buildExplanation(
    calc: ReturnType<EarlyWarningService['calculateNews2']>,
    comparisons: BaselineComparison[],
  ) {
    const elevatedComponents = calc.components.filter((component) => component.score > 0);
    const significantBaselineChanges = comparisons.filter((comparison) => comparison.outsideExpectedRange);

    const drivers = [
      ...elevatedComponents.map((component) => `${component.parameter} scored ${component.score}`),
      ...significantBaselineChanges.map((comparison) => {
        const direction = comparison.delta >= 0 ? 'above' : 'below';
        return `${comparison.metric} ${Math.abs(comparison.delta).toFixed(1)} ${direction} baseline`;
      }),
    ];

    const recommendedActions: string[] = [];
    if (calc.riskLevel === 'high') {
      recommendedActions.push('Immediate nurse and clinician review');
      recommendedActions.push('Repeat full vitals within 15 minutes');
    } else if (calc.riskLevel === 'medium') {
      recommendedActions.push('Urgent nurse review');
      recommendedActions.push('Repeat focused vitals within 30 minutes');
    } else if (calc.alertTriggered) {
      recommendedActions.push('Review abnormal component and reassess patient');
    }

    if (significantBaselineChanges.length > 0) {
      recommendedActions.push('Compare against patient baseline trend before closing alert');
    }

    const summary =
      drivers.length > 0
        ? `NEWS2 ${calc.totalScore} (${calc.riskLevel}) driven by ${drivers.join(', ')}.`
        : `NEWS2 ${calc.totalScore} (${calc.riskLevel}) with no major abnormal drivers beyond available vitals.`;

    return {
      summary,
      drivers,
      recommendedActions,
      significantBaselineChanges,
    };
  }

  private deriveEscalationSeverity(riskLevel: 'low' | 'low_medium' | 'medium' | 'high'): string {
    switch (riskLevel) {
      case 'high':
        return 'critical';
      case 'medium':
        return 'high';
      case 'low_medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private deriveEscalationDueAt(riskLevel: 'low' | 'low_medium' | 'medium' | 'high'): Date {
    const dueAt = new Date();
    const minutes =
      riskLevel === 'high' ? 15 :
      riskLevel === 'medium' ? 30 :
      riskLevel === 'low_medium' ? 120 :
      240;
    dueAt.setMinutes(dueAt.getMinutes() + minutes);
    return dueAt;
  }

  private async createEscalationTask(
    tenantDb: DataSource,
    savedScore: PatientEarlyWarningScore,
    explanation: ReturnType<EarlyWarningService['buildExplanation']>,
  ): Promise<string | null> {
    if (!savedScore.alertTriggered) {
      return null;
    }

    const escalationRepo = tenantDb.getRepository(ClinicalEscalationTask);
    const severity = this.deriveEscalationSeverity(savedScore.riskLevel || 'medium');
    const escalationTask = escalationRepo.create({
      patientId: savedScore.patientId,
      earlyWarningScoreId: savedScore.id,
      nurseTaskId: null,
      sourceModule: 'early_warning',
      sourceReferenceId: savedScore.vitalsId,
      escalationType: 'deterioration_review',
      severity,
      status: 'open',
      title: `NEWS2 escalation for patient ${savedScore.patientId}`,
      summary: explanation.summary,
      recommendedAction: explanation.recommendedActions.join('. ') || null,
      assignedTo: null,
      dueAt: this.deriveEscalationDueAt(savedScore.riskLevel || 'medium'),
      acknowledgedBy: null,
      acknowledgedAt: null,
      completedBy: null,
      completedAt: null,
      evidence: {
        totalScore: savedScore.totalScore,
        riskLevel: savedScore.riskLevel,
        components: savedScore.componentScores?.components || [],
      },
      metadata: {
        explanationDrivers: explanation.drivers,
        baselineComparisons: savedScore.componentScores?.baselineComparisons || [],
      },
    });

    const savedEscalationTask = await escalationRepo.save(escalationTask);

    if (this.nurseTaskService) {
      const nurseTask = await this.nurseTaskService.createTask(
        {
          patientId: savedScore.patientId,
          assignedBySystem: true,
          taskType: 'deterioration_review',
          priority: severity === 'critical' ? 'urgent' : 'high',
          title: 'Review patient deterioration alert',
          description: explanation.summary,
          dueDate: savedEscalationTask.dueAt ? savedEscalationTask.dueAt.toISOString() : undefined,
          sourceType: 'clinical_escalation',
          sourceId: savedEscalationTask.id,
        },
        tenantDb,
      );

      savedEscalationTask.nurseTaskId = nurseTask.id;
      await escalationRepo.save(savedEscalationTask);
    }

    return savedEscalationTask.id;
  }

  async recordNews2Score(tenantDb: DataSource, payload: News2Input, subdomain: string) {
    if (!payload.patientId) throw new BadRequestException('patientId is required');
    const calc = this.calculateNews2(payload);
    const baselineComparisons = await this.getBaselineComparisons(tenantDb, payload);
    const explanation = this.buildExplanation(calc, baselineComparisons);

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
        baselineComparisons,
        explanationSummary: explanation.summary,
        explanationDrivers: explanation.drivers,
        recommendedActions: explanation.recommendedActions,
      },
      vitalsId: payload.vitalsId ?? null,
      calculatedAt: new Date(),
      alertTriggered: calc.alertTriggered,
      alertAcknowledgedBy: null,
      alertAcknowledgedAt: null,
    });

    const saved = await repo.save(row);
    const escalationTaskId = await this.createEscalationTask(tenantDb, saved, explanation);

    // Deliver critical alert if NEWS2 >= 5
    if (saved.totalScore >= 5) {
      await this.deliverNews2Alert(subdomain, saved, explanation, tenantDb);
    }

    return {
      ...saved,
      escalationTaskId,
      explanationSummary: explanation.summary,
      recommendedActions: explanation.recommendedActions,
    };
  }

  async deliverNews2Alert(
    subdomain: string,
    score: PatientEarlyWarningScore,
    explanation: any,
    db: DataSource,
  ): Promise<void> {
    if (!this.alertDeliveryService) return;
    const severity = this.deriveEscalationSeverity(score.riskLevel || 'medium');

    await this.alertDeliveryService.broadcastCriticalAlert(subdomain, {
      alertType: 'NEWS2_CRITICAL',
      sourceEntityId: score.id,
      patientId: score.patientId,
      severity,
      message: explanation.summary,
      payload: {
        news2_score: score.totalScore,
        risk_level: score.riskLevel,
        recommended_actions: explanation.recommendedActions,
      },
    });

    // Log to delivery log
    await db.query(
      `INSERT INTO ai_alert_delivery_log
       (patient_id, alert_type, severity, delivery_channel, recipient_user_id, metadata)
       SELECT $1, 'NEWS2_CRITICAL', $2, 'PUSH', u.id, $3
       FROM users u
       WHERE u.role = 'nurse' AND u.on_call = TRUE`,
      [score.patientId, severity, JSON.stringify({ news2_score: score.totalScore })],
    );
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
    const saved = await repo.save(row);

    const escalationRepo = tenantDb.getRepository(ClinicalEscalationTask);
    const linkedTasks = await escalationRepo.find({
      where: { earlyWarningScoreId: row.id },
    });

    for (const task of linkedTasks) {
      task.status = 'acknowledged';
      task.acknowledgedAt = row.alertAcknowledgedAt;
      task.acknowledgedBy = userId ?? null;
      await escalationRepo.save(task);

      if (task.nurseTaskId && this.nurseTaskService) {
        await this.nurseTaskService.updateTask(task.nurseTaskId, { status: 'in_progress' }, tenantDb);
      } else if (task.nurseTaskId) {
        const nurseTaskRepo = tenantDb.getRepository(NurseTask);
        const nurseTask = await nurseTaskRepo.findOne({ where: { id: task.nurseTaskId } });
        if (nurseTask) {
          nurseTask.status = 'in_progress';
          await nurseTaskRepo.save(nurseTask);
        }
      }
    }

    return saved;
  }
}
