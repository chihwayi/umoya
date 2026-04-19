import { Module } from '@nestjs/common';
import { DisaSmartcareService } from './disa-smartcare.service';
import { DisaSmartcareController } from './disa-smartcare.controller';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';

@Module({
  providers: [DisaSmartcareService, TenantService, CdssService],
  controllers: [DisaSmartcareController],
  exports: [DisaSmartcareService],
})
export class DisaSmartcareModule {}
