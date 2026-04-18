import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutbreakProtocolService } from './outbreak.service';
import { OutbreakProtocolController } from './outbreak.controller';
import { PlagueCase } from './entities/plague-case.entity';
import { YellowFeverCase } from './entities/yellow-fever-case.entity';
import { MeningitisCase } from './entities/meningitis-case.entity';
import { TenantService } from '../services/tenant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlagueCase, YellowFeverCase, MeningitisCase]),
  ],
  providers: [OutbreakProtocolService, TenantService],
  controllers: [OutbreakProtocolController],
  exports: [OutbreakProtocolService],
})
export class OutbreakProtocolModule {}
