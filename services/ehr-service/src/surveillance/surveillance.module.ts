import { Module } from '@nestjs/common';
import { SurveillanceService } from './surveillance.service';
import { SurveillanceController } from './surveillance.controller';

@Module({
  providers: [SurveillanceService],
  controllers: [SurveillanceController],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
