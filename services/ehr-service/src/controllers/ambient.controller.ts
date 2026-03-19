import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AmbientService, StartSessionDto } from '../services/ambient.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Ambient AI Sessions')
@ApiBearerAuth()
@Controller('ambient')
@UseGuards(JwtAuthGuard)
export class AmbientController {
  constructor(private readonly ambientService: AmbientService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Start a new ambient AI session (REST fallback)' })
  @ApiResponse({ status: 201 })
  async startSession(@Body() dto: StartSessionDto, @Request() req: RequestWithTenant) {
    return this.ambientService.startSession(dto, req.tenantDb);
  }

  @Get('sessions/patient/:patientId')
  @ApiOperation({ summary: 'Get ambient session history for a patient' })
  @ApiResponse({ status: 200 })
  async getSessionsForPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.ambientService.getSessionsForPatient(patientId, req!.tenantDb, limit ? parseInt(limit, 10) : 10);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a specific ambient session' })
  @ApiResponse({ status: 200 })
  async getSession(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.ambientService.getSession(id, req.tenantDb);
  }

  @Patch('sessions/:id/end')
  @ApiOperation({ summary: 'End an ambient session (REST fallback)' })
  @ApiResponse({ status: 200 })
  async endSession(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.ambientService.endSession(id, req.tenantDb);
  }

  @Patch('sessions/:id/action')
  @ApiOperation({ summary: 'Record provider accept/dismiss action on AI suggestion' })
  @ApiResponse({ status: 200 })
  async recordAction(
    @Param('id') id: string,
    @Body() body: { category: 'orders' | 'diagnoses'; itemId: string; action: 'accepted' | 'dismissed' },
    @Request() req: RequestWithTenant,
  ) {
    await this.ambientService.recordProviderAction(id, body.category, body.itemId, body.action, req.tenantDb);
    return { ok: true };
  }
}
