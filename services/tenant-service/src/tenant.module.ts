import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenantController } from './controllers/tenant.controller';
import { TenantUserController } from './controllers/tenant-user.controller';
import { TenantAnalyticsController } from './controllers/tenant-analytics.controller';
import { TenantService } from './services/tenant.service';
import { TenantUserService } from './services/tenant-user.service';
import { TenantAnalyticsService } from './services/tenant-analytics.service';
import { DatabaseProvisioningService } from './services/database-provisioning.service';
import { Tenant } from './entities/tenant.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantAnalytics } from './entities/tenant-analytics.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, TenantUser, TenantAnalytics],
      synchronize: true, // Only for development
    }),
    TypeOrmModule.forFeature([Tenant, TenantUser, TenantAnalytics]),
  ],
  controllers: [TenantController, TenantUserController, TenantAnalyticsController],
  providers: [TenantService, TenantUserService, TenantAnalyticsService, DatabaseProvisioningService],
  exports: [TenantService, TenantUserService, TenantAnalyticsService],
})
export class TenantModule {}