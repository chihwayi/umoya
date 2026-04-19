import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CulturalController } from './cultural.controller';
import { CulturalService } from './cultural.service';
import { SocialDeterminant } from './entities/social-determinant.entity';
import { FamilyCouncilConsent } from './entities/family-council-consent.entity';
import { UbuntuWellbeingAssessment } from './entities/ubuntu-wellbeing-assessment.entity';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { TraditionalMedicineService } from '../services/traditional-medicine.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialDeterminant, FamilyCouncilConsent, UbuntuWellbeingAssessment]),
  ],
  providers: [CulturalService, TenantService, CdssService, TraditionalMedicineService],
  controllers: [CulturalController],
  exports: [CulturalService],
})
export class CulturalModule {}
