import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PostVisitEscalationRoutingService } from '../services/post-visit-escalation-routing.service';

@ApiTags('Post-Visit Escalations')
@Controller('post-visit-escalations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostVisitEscalationController {
  constructor(private readonly svc: PostVisitEscalationRoutingService) {}

  @Get()
  @ApiOperation({ summary: 'List open post-visit escalations' })
  getOpen(@Req() req: any) {
    return this.svc.getOpenEscalations(req.tenantDb);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an escalation' })
  acknowledge(@Param('id') id: string, @Req() req: any) {
    return this.svc.acknowledgeEscalation(id, req.user.sub, req.tenantDb);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an escalation' })
  resolve(
    @Param('id') id: string,
    @Body() body: { resolutionNote: string },
    @Req() req: any,
  ) {
    return this.svc.resolveEscalation(id, req.user.sub, body.resolutionNote, req.tenantDb);
  }
}
