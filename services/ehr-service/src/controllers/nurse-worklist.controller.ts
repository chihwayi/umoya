import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NurseWorklistService } from '../services/nurse-worklist.service';

@ApiTags('Nurse Worklist State')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nurse-worklist')
export class NurseWorklistController {
  constructor(private readonly nurseWorklistService: NurseWorklistService) {}

  @Get('state')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get server-scoped nurse task/alert state for current user' })
  @ApiResponse({ status: 200, description: 'Nurse worklist state fetched' })
  async getState(@Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.nurseWorklistService.getState(req.tenantDb, user.id);
  }

  @Post('tasks/:taskId/complete')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Persist server-scoped task completion for current user' })
  @ApiResponse({ status: 200, description: 'Task completion recorded' })
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() body: { reason?: string; patientId?: string; context?: any },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.completeTask(
      req.tenantDb,
      user,
      taskId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('alerts/:alertId/acknowledge')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Persist server-scoped alert acknowledgement for current user' })
  @ApiResponse({ status: 200, description: 'Alert acknowledgement recorded' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() body: { reason?: string; patientId?: string; context?: any },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.acknowledgeAlert(
      req.tenantDb,
      user,
      alertId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }
}
