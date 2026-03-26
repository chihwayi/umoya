import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EncounterCopilotService } from '../services/encounter-copilot.service';

@ApiTags('Encounter Copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('encounter-copilot')
export class EncounterCopilotController {
  constructor(private readonly encounterCopilotService: EncounterCopilotService) {}

  @Post('sessions')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Generate an encounter copilot session from current longitudinal context' })
  async generateSession(@Body() body: any, @Req() req: RequestWithTenant) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.encounterCopilotService.generateSession(
      req.tenantId,
      req.tenantDb!,
      body || {},
      actorUserId,
    );
  }

  @Get('sessions/:id')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get a persisted encounter copilot session with pathway recommendations' })
  async getSession(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.encounterCopilotService.getSessionById(req.tenantDb!, id);
  }

  @Get('patients/:patientId/sessions')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List recent encounter copilot sessions for a patient' })
  async listPatientSessions(
    @Param('patientId') patientId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    return this.encounterCopilotService.listPatientSessions(
      req.tenantDb!,
      patientId,
      limit ? Number(limit) : 10,
    );
  }

  @Post('sessions/:id/order-appropriateness')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Review proposed orders against encounter copilot context before finalization' })
  async reviewProposedOrders(
    @Param('id') id: string,
    @Body() body: { proposedOrders: Array<Record<string, any>> },
    @Req() req: RequestWithTenant,
  ) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.encounterCopilotService.reviewProposedOrders(
      req.tenantDb!,
      id,
      body?.proposedOrders || [],
      actorUserId,
    );
  }

  @Get('sessions/:id/order-appropriateness')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List persisted order appropriateness reviews for an encounter copilot session' })
  async listOrderAppropriatenessReviews(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.encounterCopilotService.listOrderAppropriatenessReviews(req.tenantDb!, id);
  }

  @Post('sessions/:id/result-followups')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Generate persisted result follow-up tasks from critical labs and imaging findings' })
  async generateResultFollowupTasks(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.encounterCopilotService.generateResultFollowupTasks(
      req.tenantDb!,
      id,
      actorUserId,
    );
  }

  @Get('sessions/:id/result-followups')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List persisted result follow-up tasks for an encounter copilot session' })
  async listResultFollowupTasks(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.encounterCopilotService.listResultFollowupTasks(req.tenantDb!, id);
  }
}
