import { Module } from '@nestjs/common';
import { TbaService } from './tba.service';
import { TbaController } from './tba.controller';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { CrvsService } from '../services/crvs.service';

@Module({
  providers: [TbaService, TenantService, CdssService, CrvsService],
  controllers: [TbaController],
  exports: [TbaService],
})
export class TbaModule {}
