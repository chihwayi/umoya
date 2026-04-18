import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NcdComplicationService } from '../services/ncd-complication.service';

@ApiTags('NCD Complications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ncd-complications')
export class NcdComplicationController {
  constructor(private readonly service: NcdComplicationService) {}

  @Post('foot/:patientId')
  @ApiOperation({ summary: 'Record diabetic foot assessment and return risk analysis' })
  recordFootAssessment(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.service.recordFootAssessment(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('foot/:patientId')
  @ApiOperation({ summary: 'Get diabetic foot assessment history' })
  getFootHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.getFootHistory(req.tenantId!, patientId);
  }

  @Post('retinopathy/:patientId')
  @ApiOperation({ summary: 'Record retinopathy screening' })
  recordRetinopathy(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.service.recordRetinopathyScreening(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('retinopathy/:patientId')
  @ApiOperation({ summary: 'Get retinopathy screening history' })
  getRetinopathyHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.getRetinopathyHistory(req.tenantId!, patientId);
  }

  @Post('ckd/:patientId')
  @ApiOperation({ summary: 'Record CKD staging and return management guidance' })
  recordCkd(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.service.recordCkdStaging(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('ckd/:patientId')
  @ApiOperation({ summary: 'Get CKD staging history' })
  getCkdHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.getCkdHistory(req.tenantId!, patientId);
  }

  @Get('register')
  @ApiOperation({ summary: 'List patients with NCD complications' })
  getRegister(
    @Query('complicationType') complicationType: string | undefined,
    @Query('highRiskOnly') highRiskOnly: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.service.getComplicationRegister(req.tenantId!, {
      complicationType,
      highRiskOnly: highRiskOnly === 'true',
    });
  }
}
