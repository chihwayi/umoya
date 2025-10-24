import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { EmailService } from './email.service';

export interface HealthCheck {
  tenantId: string;
  tenantName: string;
  databaseStatus: 'healthy' | 'unhealthy' | 'unknown';
  connectionTime: number;
  lastChecked: Date;
  error?: string;
}

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);
  private healthCache = new Map<string, HealthCheck>();

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthChecks() {
    this.logger.log('Starting health checks for all tenants');
    
    const activeTenants = await this.tenantRepository.find({
      where: { status: TenantStatus.ACTIVE }
    });

    const healthPromises = activeTenants.map(tenant => 
      this.checkTenantHealth(tenant)
    );

    const results = await Promise.allSettled(healthPromises);
    
    let healthyCount = 0;
    let unhealthyCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const health = result.value;
        this.healthCache.set(health.tenantId, health);
        
        if (health.databaseStatus === 'healthy') {
          healthyCount++;
        } else {
          unhealthyCount++;
          this.handleUnhealthyTenant(activeTenants[index], health);
        }
      }
    });

    this.logger.log(`Health check completed: ${healthyCount} healthy, ${unhealthyCount} unhealthy`);
  }

  async checkTenantHealth(tenant: Tenant): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      if (!tenant.connectionString) {
        return {
          tenantId: tenant.id,
          tenantName: tenant.clinicName,
          databaseStatus: 'unknown',
          connectionTime: 0,
          lastChecked: new Date(),
          error: 'No connection string configured'
        };
      }

      const dataSource = new DataSource({
        type: 'postgres',
        url: tenant.connectionString,
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();
      
      // Test query
      await dataSource.query('SELECT 1');
      await dataSource.destroy();

      const connectionTime = Date.now() - startTime;

      return {
        tenantId: tenant.id,
        tenantName: tenant.clinicName,
        databaseStatus: 'healthy',
        connectionTime,
        lastChecked: new Date(),
      };

    } catch (error) {
      const connectionTime = Date.now() - startTime;
      
      return {
        tenantId: tenant.id,
        tenantName: tenant.clinicName,
        databaseStatus: 'unhealthy',
        connectionTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  private async handleUnhealthyTenant(tenant: Tenant, health: HealthCheck) {
    this.logger.error(`Tenant ${tenant.clinicName} is unhealthy: ${health.error}`);
    
    // Send alert email to admin
    await this.emailService.sendEmail({
      to: 'admin@medicore.co.zw',
      subject: `ALERT: Tenant Database Issue - ${tenant.clinicName}`,
      html: `
        <h2>Tenant Database Health Alert</h2>
        <p><strong>Tenant:</strong> ${tenant.clinicName}</p>
        <p><strong>Status:</strong> ${health.databaseStatus}</p>
        <p><strong>Error:</strong> ${health.error}</p>
        <p><strong>Connection Time:</strong> ${health.connectionTime}ms</p>
        <p><strong>Last Checked:</strong> ${health.lastChecked}</p>
        <p>Please investigate immediately.</p>
      `
    });
  }

  getHealthStatus(tenantId: string): HealthCheck | null {
    return this.healthCache.get(tenantId) || null;
  }

  getAllHealthStatuses(): HealthCheck[] {
    return Array.from(this.healthCache.values());
  }

  async getSystemHealth() {
    const allHealth = this.getAllHealthStatuses();
    const healthy = allHealth.filter(h => h.databaseStatus === 'healthy').length;
    const unhealthy = allHealth.filter(h => h.databaseStatus === 'unhealthy').length;
    const unknown = allHealth.filter(h => h.databaseStatus === 'unknown').length;

    return {
      totalTenants: allHealth.length,
      healthy,
      unhealthy,
      unknown,
      lastCheck: allHealth.length > 0 ? Math.max(...allHealth.map(h => h.lastChecked.getTime())) : null,
      averageConnectionTime: allHealth.length > 0 
        ? allHealth.reduce((sum, h) => sum + h.connectionTime, 0) / allHealth.length 
        : 0
    };
  }
}