import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PriorAuthorizationService } from '../services/prior-authorization.service';

@ApiTags('Prior Authorization')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prior-authorizations')
export class PriorAuthorizationController {
  constructor(private readonly service: PriorAuthorizationService) {}

  @Get()
  @ApiOperation({ summary: 'List prior authorizations' })
  @ApiResponse({ status: 200 })
  list(
    @Query('patientId') patientId: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    return this.service.list(req.tenantDb, { patientId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prior authorization by id' })
  @ApiResponse({ status: 200 })
  get(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.getById(req.tenantDb, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create prior authorization (draft)' })
  @ApiResponse({ status: 201 })
  create(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.service.create(req.tenantDb, userId, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update prior authorization' })
  @ApiResponse({ status: 200 })
  update(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.update(req.tenantDb, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete prior authorization' })
  @ApiResponse({ status: 200 })
  delete(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.delete(req.tenantDb, id);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Update status + workflow fields' })
  @ApiResponse({ status: 200 })
  setStatus(
    @Param('id') id: string,
    @Body()
    body: {
      status: 'draft' | 'submitted' | 'pending' | 'approved' | 'denied' | 'expired' | 'appeal';
      authorizationNumber?: string;
      authorizedUnits?: number;
      authorizedFrom?: string;
      authorizedTo?: string;
      denialReason?: string;
      appealDeadline?: string;
      notes?: string;
    },
    @Req() req: RequestWithTenant,
  ) {
    return this.service.setStatus(req.tenantDb, id, body.status, body);
  }
}

