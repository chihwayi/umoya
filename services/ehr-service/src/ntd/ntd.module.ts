import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NtdService } from './ntd.service';
import { NtdController } from './ntd.controller';
import { LeprosyCase } from './entities/leprosy-case.entity';
import { OnchocerciasisCase } from './entities/onchocerciasis-case.entity';
import { FilariasisCase } from './entities/filariasis-case.entity';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { MetricsService } from '../services/metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeprosyCase, OnchocerciasisCase, FilariasisCase]),
  ],
  providers: [NtdService, TenantService, CdssService, MetricsService],
  controllers: [NtdController],
  exports: [NtdService],
})
export class NtdModule {}
