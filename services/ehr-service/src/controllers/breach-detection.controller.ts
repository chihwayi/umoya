import {
  Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BreachDetectionService } from '../services/breach-detection.service';
import { BackupService } from '../services/backup.service';
import { PotrazNotificationService } from '../services/potraz-notification.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class BreachDetectionController {
  constructor(
    private readonly breachDetection: BreachDetectionService,
    private readonly backup: BackupService,
    private readonly potraz: PotrazNotificationService,
  ) {}

  @Get('anomalies')
  getOpenAnomalies(@Query('page') page = 1, @Req() req: Request) {
    return this.breachDetection.getOpenAnomalies((req as any).tenantDb, +page);
  }

  @Get('anomalies/stats')
  getAnomalyStats(@Req() req: Request) {
    return this.breachDetection.getAnomalyStats((req as any).tenantDb);
  }

  @Patch('anomalies/:id/acknowledge')
  acknowledgeAnomaly(
    @Param('id') id: string,
    @Body() body: { isFalsePositive: boolean },
    @Req() req: Request,
  ) {
    const { user, tenantDb } = req as any;
    return this.breachDetection.acknowledgeAnomaly(id, user.sub, body.isFalsePositive, tenantDb);
  }

  @Get('audit-chain/verify')
  verifyAuditChain(@Req() req: Request) {
    return this.breachDetection.verifyAuditChain((req as any).tenantDb);
  }

  @Post('backup/run')
  async runBackup(@Req() req: Request) {
    const { user } = req as any;
    if (user?.role !== 'admin') throw new ForbiddenException('Admin only');
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.backup.backupTenant(tenantId, `medicore_${tenantId}`);
  }

  @Get('backup/jobs')
  listBackupJobs(@Req() req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.backup.listBackupJobs(tenantId);
  }

  @Post('backup/:id/verify')
  verifyBackup(@Param('id') id: string) {
    return this.backup.verifyBackupIntegrity(id);
  }

  @Get('incidents')
  listIncidents(@Req() req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.potraz.listIncidents(tenantId);
  }

  @Post('incidents')
  createIncident(@Body() body: any, @Req() req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.potraz.createIncident({ ...body, tenantId });
  }

  @Post('incidents/:id/notify-potraz')
  notifyPotraz(@Param('id') id: string) {
    return this.potraz.notifyPotraz(id);
  }

  @Post('incidents/:id/remediate')
  remediateIncident(@Param('id') id: string) {
    return this.potraz.remediateIncident(id);
  }

  @Post('incidents/:id/close')
  closeIncident(@Param('id') id: string) {
    return this.potraz.closeIncident(id);
  }

  @Post('dr-test')
  async recordDrTest(@Body() body: any, @Req() req: Request) {
    const { tenantDb } = req as any;
    await this.backup.recordDrTest(
      tenantDb,
      body.backupJobId ?? null,
      body.rtoMinutes ?? 0,
      body.rpoHours ?? 0,
      body.result ?? 'manual',
      body.notes ?? '',
    );
    return { ok: true };
  }
}
