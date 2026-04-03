import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantController } from './controllers/tenant.controller';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { TenantUserController } from './controllers/tenant-user.controller';
import { TenantAnalyticsController } from './controllers/tenant-analytics.controller';
import { TenantService } from './services/tenant.service';
import { TenantAnalyticsService } from './services/tenant-analytics.service';
import { DatabaseProvisioningService } from './services/database-provisioning.service';
import { TenantDatabaseService } from './services/tenant-database.service';
import { AuthService } from './services/auth.service';
import { AuditService } from './services/audit.service';
import { EmailService } from './services/email.service';
import { HealthMonitorService } from './services/health-monitor.service';
import { PlatformServiceMonitorService } from './services/platform-service-monitor.service';
import { RuntimeEndpointConfigService } from './services/runtime-endpoint-config.service';
import { TenantDriftService } from './services/tenant-drift.service';
import { BackupService } from './services/backup.service';
import { BackupScheduleService } from './services/backup-schedule.service';
import { StorageService } from './services/storage.service';
import { AuthController } from './controllers/auth.controller';
import { BackupController } from './controllers/backup.controller';
import { DemoAccessRequestController } from './controllers/demo-access-request.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Tenant } from './entities/tenant.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantAnalytics } from './entities/tenant-analytics.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { DemoAccessRequest } from './entities/demo-access-request.entity';
import { DemoAccessRequestService } from './services/demo-access-request.service';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'dev-only-tenant-secret-change-me';
  }

  throw new Error('JWT_SECRET is required for tenant-service outside development/test');
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '24h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog, DemoAccessRequest],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog, DemoAccessRequest]),
  ],
  controllers: [TenantController, TenantUserController, TenantAnalyticsController, AuthController, AdminMaintenanceController, BackupController, DemoAccessRequestController],
  providers: [
    TenantService, 
    TenantAnalyticsService, 
    DatabaseProvisioningService, 
    TenantDatabaseService,
    AuthService,
    AuditService,
    EmailService,
    HealthMonitorService,
    RuntimeEndpointConfigService,
    PlatformServiceMonitorService,
    BackupService,
    BackupScheduleService,
    StorageService,
    DemoAccessRequestService,
    TenantDriftService,
    JwtStrategy
  ],
  exports: [TenantService, TenantAnalyticsService, TenantDatabaseService, AuthService],
})
export class TenantModule {}
