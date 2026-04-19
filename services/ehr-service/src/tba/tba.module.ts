import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TbaService } from './tba.service';
import { TbaController } from './tba.controller';
import { TbaRegister } from './entities/tba-register.entity';
import { HomeBirthRecord } from './entities/home-birth-record.entity';
import { TenantService } from '../services/tenant.service'; // Ensure TenantService is provided or imported
import { CdssService } from '../services/cdss.service'; // Ensure CdssService is provided or imported
import { CrvsService } from '../services/crvs.service'; // Ensure CrvsService is provided or imported

@Module({
  imports: [
    TypeOrmModule.forFeature([TbaRegister, HomeBirthRecord]),
  ],
  providers: [TbaService, TenantService, CdssService, CrvsService], // Injecting services needed by TbaService
  controllers: [TbaController],
  exports: [TbaService], // Export TbaService if needed by other modules
})
export class TbaModule {}
