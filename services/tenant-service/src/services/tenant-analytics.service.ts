import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAnalytics, MetricType } from '../entities/tenant-analytics.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantUser } from '../entities/tenant-user.entity';

@Injectable()
export class TenantAnalyticsService {
  constructor(
    @InjectRepository(TenantAnalytics)
    private analyticsRepository: Repository<TenantAnalytics>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantUser)
    private tenantUserRepository: Repository<TenantUser>,
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

    return {
      tenant,
      users: {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        byRole: this.groupByRole(users)
      },
      metrics,
      generatedAt: new Date()
    };
  }

  private groupByRole(users: TenantUser[]): any {
    return users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
  }
}