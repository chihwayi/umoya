import { Module } from '@nestjs/common';
import { NtdService } from './ntd.service';
import { NtdController } from './ntd.controller';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { MetricsService } from '../services/metrics.service';

@Module({
  providers: [NtdService, TenantService, CdssService, MetricsService],
  controllers: [NtdController],
  exports: [NtdService],
})
export class NtdModule {}
