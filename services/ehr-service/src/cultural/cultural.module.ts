import { Module } from '@nestjs/common';
import { CulturalController } from './cultural.controller';
import { CulturalService } from './cultural.service';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { TraditionalMedicineService } from '../services/traditional-medicine.service';

@Module({
  providers: [CulturalService, TenantService, CdssService, TraditionalMedicineService],
  controllers: [CulturalController],
  exports: [CulturalService],
})
export class CulturalModule {}
