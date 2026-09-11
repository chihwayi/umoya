import { UseGuards, Controller, Get, Post, Body, Param, Req, Query } from '@nestjs/common';
import { SmartDefaultsService } from '../services/smart-defaults.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('forms/intelligence')
@UseGuards(JwtAuthGuard)
export class SmartDefaultsController {
  constructor(private readonly svc: SmartDefaultsService) {}

  @Get('config')
  listConfigs(@Req() req: RequestWithTenant) {
    return this.svc.listConfigs(req.tenantDb!);
  }

  @Post('config')
  upsertConfig(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.upsertConfig(req.tenantDb!, dto);
  }

  @Post(':formName/defaults')
  getDefaults(@Req() req: RequestWithTenant, @Param('formName') formName: string, @Body() context: any) {
    return this.svc.getDefaults(req.tenantDb!, formName, context);
  }

  @Post(':formName/visibility')
  getVisibility(@Req() req: RequestWithTenant, @Param('formName') formName: string, @Body() context: any) {
    return this.svc.getVisibility(req.tenantDb!, formName, context);
  }

  @Post('ai/suggest')
  aiSuggestDefaults(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.aiSuggestDefaults(req.tenantId!, req.tenantDb!, dto);
  }
}
