import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { SepsisService } from '../services/sepsis.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Sepsis Management')
@ApiBearerAuth()
@Controller('sepsis')
@UseGuards(JwtAuthGuard)
export class SepsisController {
  constructor(
    private readonly sepsisService: SepsisService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('screenings')
  async screenForSepsis(@Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.screenForSepsis(data, req.user.id, tenantDb);
  }

  @Post('bundles')
  async initiateSepsisBundle(@Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.initiateSepsisBundle(data, req.user.id, tenantDb);
  }

  @Put('bundles/:id/element')
  async updateBundleElement(@Param('id') id: string, @Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.updateBundleElement(id, data.element, data.value, tenantDb);
  }

  @Get('alerts')
  async getSepsisAlerts(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.getSepsisAlerts(tenantDb);
  }

  @Get('compliance')
  async getBundleCompliance(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.sepsisService.getBundleCompliance(start, end, tenantDb);
  }
}




