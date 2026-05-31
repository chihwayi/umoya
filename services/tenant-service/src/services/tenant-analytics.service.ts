import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAnalytics, MetricType } from '../entities/tenant-analytics.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantUser, UserStatus } from '../entities/tenant-user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { TenantApiKey } from '../entities/tenant-api-key.entity';

@Injectable()
export class TenantAnalyticsService {
  constructor(
    @InjectRepository(TenantAnalytics)
    private analyticsRepository: Repository<TenantAnalytics>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantUser)
    private tenantUserRepository: Repository<TenantUser>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(TenantApiKey)
    private apiKeyRepository: Repository<TenantApiKey>,
  ) {}

  async recordMetric(tenantId: string, metricType: MetricType, value: number, metadata?: any): Promise<void> {
    const metric = this.analyticsRepository.create({
      tenantId,
      metricType,
      value,
      recordDate: new Date(),
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    await this.analyticsRepository.save(metric);
  }

  async getTenantMetrics(tenantId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.analyticsRepository.find({
      where: {
        tenantId,
      },
      order: { recordDate: 'DESC' }
    });

    return this.formatMetrics(metrics);
  }

  /**
   * Real per-tenant usage, aggregated live from the master DB (no synthetic data):
   *  - users: counts by status/role + recently-active (lastLogin) + new-in-period (createdAt)
   *  - apiKeys: total/active/last-used + the configured rate limit
   *  - activityTrend: per-day audit-event counts for this tenant over `days`
   */
  async getTenantUsage(tenantId: string, days: number = 30): Promise<any> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const users = await this.tenantUserRepository.find({ where: { tenantId } });
    const byRole: Record<string, number> = {};
    let active = 0;
    let recentlyActive = 0;
    let newInPeriod = 0;
    for (const u of users) {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
      if (u.status === UserStatus.ACTIVE) active += 1;
      if (u.lastLogin && new Date(u.lastLogin) >= since) recentlyActive += 1;
      if (u.createdAt && new Date(u.createdAt) >= since) newInPeriod += 1;
    }

    const apiKeys = await this.apiKeyRepository.find({ where: { tenantId } });
    const activeKeys = apiKeys.filter((k) => !k.revokedAt && (!k.expiresAt || new Date(k.expiresAt) > new Date()));
    const lastKeyUse = apiKeys
      .map((k) => k.lastUsedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b as any).getTime() - new Date(a as any).getTime())[0] || null;

    // Per-day activity from the audit trail (real events scoped to this tenant).
    const auditRows = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select("to_char(audit.createdAt, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('audit.resourceId = :tenantId', { tenantId })
      .andWhere('audit.createdAt >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const trendMap = new Map<string, number>();
    auditRows.forEach((r) => trendMap.set(r.day, Number(r.count)));
    const activityTrend: { date: string; count: number }[] = [];
    const cursor = new Date(since);
    for (let i = 0; i < days; i++) {
      const key = cursor.toISOString().slice(0, 10);
      activityTrend.push({ date: key, count: trendMap.get(key) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    const totalEvents = activityTrend.reduce((sum, d) => sum + d.count, 0);

    return {
      tenantId,
      periodDays: days,
      since: since.toISOString(),
      users: {
        total: users.length,
        active,
        recentlyActive,
        newInPeriod,
        byRole,
      },
      apiKeys: {
        total: apiKeys.length,
        active: activeKeys.length,
        lastUsedAt: lastKeyUse,
        rateLimitPerMin: tenant.apiRateLimitPerMin ?? null,
      },
      activity: {
        totalEvents,
        trend: activityTrend,
      },
    };
  }

  async getAllTenantsOverview(): Promise<any> {
    const tenants = await this.tenantRepository.find();
    const overview = [];

    for (const tenant of tenants) {
      const userCount = await this.tenantUserRepository.count({
        where: { tenantId: tenant.id }
      });

      const recentMetrics = await this.analyticsRepository.find({
        where: { tenantId: tenant.id },
        order: { recordDate: 'DESC' },
        take: 10
      });

      overview.push({
        tenant,
        userCount,
        metrics: this.formatMetrics(recentMetrics),
        lastActivity: recentMetrics[0]?.recordDate || tenant.createdAt
      });
    }

    return overview;
  }

  async getSystemWideStats(): Promise<any> {
    const totalTenants = await this.tenantRepository.count();
    const activeTenants = await this.tenantRepository.count({
      where: { status: 'active' as any }
    });
    const totalUsers = await this.tenantUserRepository.count();

    const tenantsByTier = await this.tenantRepository
      .createQueryBuilder('tenant')
      .select('tenant.subscriptionTier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tenant.subscriptionTier')
      .getRawMany();

    const recentSignups = await this.tenantRepository.find({
      order: { createdAt: 'DESC' },
      take: 5
    });

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      tenantsByTier,
      recentSignups,
      activationRate: totalTenants > 0 ? (activeTenants / totalTenants * 100).toFixed(1) : 0
    };
  }

  private formatMetrics(metrics: TenantAnalytics[]): any {
    const formatted = {};
    
    metrics.forEach(metric => {
      if (!formatted[metric.metricType]) {
        formatted[metric.metricType] = [];
      }
      formatted[metric.metricType].push({
        value: metric.value,
        date: metric.recordDate,
        metadata: metric.metadata ? JSON.parse(metric.metadata) : null
      });
    });

    return formatted;
  }

  async generateTenantReport(tenantId: string): Promise<any> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const users = await this.tenantUserRepository.find({
      where: { tenantId }
    });

    const metrics = await this.getTenantMetrics(tenantId, 90);
    const activeCount = users.filter(u => u.status === 'active').length;
    const lastLoginDates = users.map(u => u.lastLogin).filter(Boolean) as Date[];
    const lastActivity = lastLoginDates.length
      ? new Date(Math.max(...lastLoginDates.map(d => new Date(d).getTime())))
      : (tenant as any).updatedAt ?? tenant.createdAt;

    return {
      tenant: {
        id: tenant.id,
        clinicName: tenant.clinicName,
        subdomain: tenant.subdomain,
        status: tenant.status,
        createdAt: tenant.createdAt,
        updatedAt: (tenant as any).updatedAt,
      },
      kpis: {
        totalUsers: users.length,
        activeUsers: activeCount,
        lastActivity: lastActivity,
      },
      users: {
        total: users.length,
        active: activeCount,
        byRole: this.groupByRole(users),
      },
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  private groupByRole(users: TenantUser[]): any {
    return users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
  }
}