import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalStaffCredentialingService } from '../services/clinical-staff-credentialing.service';

@UseGuards(JwtAuthGuard)
@Controller('staff-credentialing')
export class ClinicalStaffCredentialingController {
  constructor(private readonly svc: ClinicalStaffCredentialingService) {}

  @Post('credentials')
  createCredential(@Req() req: any, @Body() body: any) {
    return this.svc.createCredential(req.tenantDb, req.tenantId, body);
  }

  @Get('credentials')
  listCredentials(@Req() req: any, @Query() query: any) {
    return this.svc.listCredentials(req.tenantDb, req.tenantId, query);
  }

  @Get('credentials/expiry-alerts')
  getExpiryAlerts(@Req() req: any) {
    return this.svc.getExpiryAlerts(req.tenantDb, req.tenantId);
  }

  @Get('credentials/:id')
  getCredential(@Req() req: any, @Param('id') id: string) {
    return this.svc.getCredential(req.tenantDb, req.tenantId, id);
  }

  @Patch('credentials/:id')
  updateCredential(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateCredential(req.tenantDb, req.tenantId, id, body);
  }

  @Post('credentials/:id/privileges')
  grantPrivilege(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.grantPrivilege(req.tenantDb, req.tenantId, id, req.user.id, body);
  }

  @Patch('privileges/:privilegeId/revoke')
  revokePrivilege(@Req() req: any, @Param('privilegeId') privilegeId: string, @Body() body: { reason?: string }) {
    return this.svc.revokePrivilege(req.tenantDb, req.tenantId, privilegeId, req.user.id, body?.reason);
  }

  @Get('check-privilege')
  checkPrivilege(@Req() req: any, @Query('userId') userId: string, @Query('procedure') procedure: string) {
    return this.svc.checkPrivilege(req.tenantDb, req.tenantId, userId, procedure);
  }
}
