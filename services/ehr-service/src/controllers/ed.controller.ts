import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EDService } from '../services/ed.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Emergency Department')
@ApiBearerAuth()
@Controller('ed')
@UseGuards(JwtAuthGuard)
export class EDController {
  constructor(
    private readonly edService: EDService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('visits')
  @ApiOperation({ summary: 'Register ED visit' })
  async registerVisit(@Body() visitData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.edService.registerEDVisit(visitData, req.user.userId, tenantDb);
  }

  @Post('visits/:id/triage')
  @ApiOperation({ summary: 'Triage ED patient (ESI)' })
  @HttpCode(HttpStatus.OK)
  async triagePatient(
    @Param('id') visitId: string,
    @Body() triageData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.edService.triagePatient(visitId, triageData, req.user.userId, tenantDb);
  }

  @Get('tracking-board')
  @ApiOperation({ summary: 'Get ED tracking board' })
  async getTrackingBoard(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.edService.getEDTrackingBoard(tenantDb);
  }

  @Post('visits/:id/status')
  @ApiOperation({ summary: 'Update ED visit status' })
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') visitId: string,
    @Body('status') status: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.edService.updateEDStatus(visitId, status, req.user.userId, tenantDb);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get ED metrics' })
  async getMetrics(@Query('date') date: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const targetDate = date ? new Date(date) : new Date();
    return await this.edService.getEDMetrics(targetDate, tenantDb);
  }
}

