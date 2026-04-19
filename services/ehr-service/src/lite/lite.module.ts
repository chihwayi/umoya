import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiteService } from './lite.service';
import { LiteController } from './lite.controller';
import { OfflineSyncQueue } from './entities/offline-sync-queue.entity';
import { UssdClinicalEntry } from './entities/ussd-clinical-entry.entity';
import { TenantServiceModule } from '../modules/tenant-service.module'; // Adjust path if needed
import { TenantService } from '../services/tenant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OfflineSyncQueue, UssdClinicalEntry]),
  ],
  providers: [LiteService, TenantService],
  controllers: [LiteController],
  exports: [LiteService],
})
export class LiteModule {}
