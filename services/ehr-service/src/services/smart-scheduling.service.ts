import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { SchedulingAiPrediction } from '../entities/scheduling-ai-prediction.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class SmartSchedulingService {
  private readonly logger = new Logger(SmartSchedulingService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async predictAppointment(subdomain: string, appointmentId: string, features: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let predData: any = { no_show_probability: 0.1, cancel_probability: 0.05, recommended_duration: 30, confidence_score: 0.5, model: 'default', feature_importance: {} };
    try {
      predData = await this.cdssService.predictSchedulingRisk(
        { appointmentId, ...features },
        subdomain,
        ds,
      );
    } catch (e: any) {
      this.logger.warn(`Scheduling prediction failed for ${appointmentId}: ${e?.message}`);
    }

    const repo = ds.getRepository(SchedulingAiPrediction);
    const existing = await repo.findOneBy({ appointmentId });
    const prediction = {
      appointmentId,
      noShowProbability: predData.no_show_probability,
      cancelProbability: predData.cancel_probability,
      recommendedDuration: predData.recommended_duration,
      confidenceScore: predData.confidence_score,
      featureImportance: predData.feature_importance || {},
      model: predData.model,
      predictionDate: new Date(),
    };
    if (existing) {
      await repo.update(existing.id, prediction);
      // Update appointment risk column
      await this.updateAppointmentRisk(ds, appointmentId, predData);
      return repo.findOneBy({ id: existing.id });
    }
    await this.updateAppointmentRisk(ds, appointmentId, predData);
    return repo.save(repo.create(prediction));
  }

  async getPrediction(subdomain: string, appointmentId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SchedulingAiPrediction).findOneBy({ appointmentId });
  }

  async getHighRiskAppointments(subdomain: string, days = 7) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return ds.query(
      `SELECT a.*, s.no_show_probability, s.recommended_duration
       FROM appointments a
       JOIN scheduling_ai_predictions s ON s.appointment_id = a.id
       WHERE a.appointment_date <= $1 AND a.appointment_date >= NOW()
         AND s.no_show_probability >= 0.6
       ORDER BY s.no_show_probability DESC`,
      [cutoff.toISOString()]
    );
  }

  // ── Daily prediction run for next 7 days ──────────────────────────────────
  @Cron('0 6 * * *') // every day at 6am
  async runDailyPredictions() {
    this.logger.log('Running daily scheduling AI predictions…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          continue;
        }
        await this.predictNextWeek(subdomain).catch(e =>
          this.logger.error(`Scheduling prediction failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`Daily scheduling prediction error: ${e?.message}`);
    }
  }

  private async predictNextWeek(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 7);
    const appointments = await ds.query(
      `SELECT id FROM appointments WHERE appointment_date BETWEEN NOW() AND $1 AND status != 'cancelled'`,
      [cutoff.toISOString()]
    );
    for (const apt of appointments) {
      await this.predictAppointment(subdomain, apt.id, {}).catch(() => {});
    }
  }

  private async updateAppointmentRisk(ds: any, appointmentId: string, predData: any) {
    const risk = predData.no_show_probability >= 0.7 ? 'high'
      : predData.no_show_probability >= 0.4 ? 'medium' : 'low';
    await ds.query(
      `UPDATE appointments SET no_show_risk = $1, ai_recommended_duration = $2 WHERE id = $3`,
      [risk, predData.recommended_duration, appointmentId]
    ).catch(() => {}); // column may not exist yet on older tenants
  }
}
