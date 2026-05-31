import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantController } from './controllers/tenant.controller';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { TenantUserController } from './controllers/tenant-user.controller';
import { TenantAnalyticsController } from './controllers/tenant-analytics.controller';
import { RolloutController } from './controllers/rollout.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { TenantService } from './services/tenant.service';
import { BillingEnforcerService } from './services/billing-enforcer.service';
import { SmsService } from './services/sms.service';
import { FlutterwaveProvider } from './payment/providers/flutterwave.provider';
import { MpesaProvider } from './payment/providers/mpesa.provider';
import { ZimSwitchProvider } from './payment/providers/zimswitch.provider';
import { StripeProvider } from './payment/providers/stripe.provider';
import { PaymentGatewayFactory } from './payment/payment-gateway.factory';
import { PaymentService } from './payment/payment.service';
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
import { BaaRegistryController } from './controllers/baa-registry.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Tenant } from './entities/tenant.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantAnalytics } from './entities/tenant-analytics.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { DemoAccessRequest } from './entities/demo-access-request.entity';
import { BaaRegistryEntry } from './entities/baa-registry.entity';
import { TenantApiKey } from './entities/tenant-api-key.entity';
import { ApiKeyService } from './services/api-key.service';
import { TokenDenylistService } from './services/token-denylist.service';
import { DemoAccessRequestService } from './services/demo-access-request.service';
import { BaaRegistryService } from './services/baa-registry.service';

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
      // 24h was too long for a high-privilege admin token (a leaked token would
      // be valid a full day with no server-side revocation). Default to an 8h
      // work-session; override via ADMIN_JWT_EXPIRES_IN (e.g. '2h', '30m').
      signOptions: { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog, DemoAccessRequest, BaaRegistryEntry, TenantApiKey],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Tenant, TenantUser, TenantAnalytics, AdminUser, AuditLog, DemoAccessRequest, BaaRegistryEntry, TenantApiKey]),
  ],
  controllers: [TenantController, TenantUserController, TenantAnalyticsController, RolloutController, PaymentWebhookController, AuthController, AdminMaintenanceController, BackupController, DemoAccessRequestController, BaaRegistryController],
  providers: [
    TenantService, 
    BillingEnforcerService,
    SmsService,
    FlutterwaveProvider,
    MpesaProvider,
    ZimSwitchProvider,
    StripeProvider,
    PaymentGatewayFactory,
    PaymentService,
    TenantAnalyticsService, 
    DatabaseProvisioningService, 
    TenantDatabaseService,
    AuthService,
    AuditService,
    ApiKeyService,
    TokenDenylistService,
    EmailService,
    HealthMonitorService,
    RuntimeEndpointConfigService,
    PlatformServiceMonitorService,
    BackupService,
    BackupScheduleService,
    StorageService,
    DemoAccessRequestService,
    BaaRegistryService,
    TenantDriftService,
    JwtStrategy
  ],
  exports: [TenantService, TenantAnalyticsService, TenantDatabaseService, AuthService],
})
export class TenantModule {}
