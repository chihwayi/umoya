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
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Tenant } from './entities/tenant.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantAnalytics } from './entities/tenant-analytics.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'medicore-super-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog]),
  ],
  controllers: [TenantController, TenantUserController, TenantAnalyticsController, AuthController, AdminMaintenanceController],
  providers: [
    TenantService, 
    TenantAnalyticsService, 
    DatabaseProvisioningService, 
    TenantDatabaseService,
    AuthService,
    AuditService,
    EmailService,
    HealthMonitorService,
    JwtStrategy
  ],
  exports: [TenantService, TenantAnalyticsService, TenantDatabaseService, AuthService],
})
export class TenantModule {}