import { Module } from '@nestjs/common';
import { LanguageController } from './language.controller';
import { LanguageService } from './language.service';
import { TenantService } from '../services/tenant.service';

@Module({
  providers: [LanguageService, TenantService],
  controllers: [LanguageController],
  exports: [LanguageService],
})
export class LanguageModule {}
