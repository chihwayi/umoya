import { Controller, Get, Post, Body, Param, Headers, Query } from '@nestjs/common';
import { SmartDefaultsService } from '../services/smart-defaults.service';

@Controller('forms/intelligence')
export class SmartDefaultsController {
  constructor(private readonly svc: SmartDefaultsService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Get('config')
  listConfigs(@Headers() h: Record<string, string>) {
    return this.svc.listConfigs(this.tenant(h));
  }

  @Post('config')
  upsertConfig(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.upsertConfig(this.tenant(h), dto);
  }

  @Post(':formName/defaults')
  getDefaults(@Headers() h: Record<string, string>, @Param('formName') formName: string, @Body() context: any) {
    return this.svc.getDefaults(this.tenant(h), formName, context);
  }

  @Post(':formName/visibility')
  getVisibility(@Headers() h: Record<string, string>, @Param('formName') formName: string, @Body() context: any) {
    return this.svc.getVisibility(this.tenant(h), formName, context);
  }

  @Post('ai/suggest')
  aiSuggestDefaults(@Body() dto: any) {
    return this.svc.aiSuggestDefaults(dto);
  }
}
