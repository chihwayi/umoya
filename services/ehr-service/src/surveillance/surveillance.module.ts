import { Module } from '@nestjs/common';
import { SurveillanceService } from './surveillance.service';
import { SurveillanceController } from './surveillance.controller';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';

@Module({
  providers: [SurveillanceService, TenantService, CdssService],
  controllers: [SurveillanceController],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
