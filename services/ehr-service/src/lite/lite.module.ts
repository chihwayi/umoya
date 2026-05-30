import { Module } from '@nestjs/common';
import { LiteService } from './lite.service';
import { LiteController } from './lite.controller';
import { TenantService } from '../services/tenant.service';

@Module({
  providers: [LiteService, TenantService],
  controllers: [LiteController],
  exports: [LiteService],
})
export class LiteModule {}
