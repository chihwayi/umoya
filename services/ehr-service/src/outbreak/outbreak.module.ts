import { Module } from '@nestjs/common';
import { OutbreakProtocolService } from './outbreak.service';
import { OutbreakProtocolController } from './outbreak.controller';
import { TenantService } from '../services/tenant.service';

@Module({
  providers: [OutbreakProtocolService, TenantService],
  controllers: [OutbreakProtocolController],
  exports: [OutbreakProtocolService],
})
export class OutbreakProtocolModule {}
