import { UseGuards, Controller, Get, Patch, Post, Param, Body, Req } from '@nestjs/common';
import {
  ClinicalConflictResolutionService,
  SyncConflict,
} from '../services/clinical-conflict-resolution.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('conflict-queue')
@UseGuards(JwtAuthGuard)
export class ConflictResolutionController {
  constructor(private readonly svc: ClinicalConflictResolutionService) {}

  /** Called by mobile on reconnect — batch of field-level conflicts */
  @Post('/sync/conflicts')
  async handleSync(
    @Req() req: any,
    @Body() body: { conflicts: SyncConflict[] },
  ) {
    const results = await Promise.all(
      body.conflicts.map((c) => this.svc.resolveConflict(req.tenantDb, c)),
    );
    const queued = results.filter((r) => r.action === 'queued');
    return { processed: results.length, queued: queued.length, results };
  }

  /** All pending conflicts across all patients — for EHR global badge */
  @Get('all')
  async getAll(@Req() req: any) {
    return this.svc.getAllPending(req.tenantDb);
  }

  /** Pending conflicts for a specific patient — for patient chart sidebar */
  @Get('patient/:patientId')
  async getForPatient(@Req() req: any, @Param('patientId') id: string) {
    return this.svc.getPendingForPatient(req.tenantDb, id);
  }

  /** Badge count for nav sidebar */
  @Get('count')
  async getCount(@Req() req: any) {
    return { count: await this.svc.getPendingCount(req.tenantDb) };
  }

  /** Clinician picks server or device version */
  @Patch(':id/resolve')
  async resolve(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      resolution: 'resolved_keep_server' | 'resolved_keep_client';
      resolvedBy: string;
      note?: string;
    },
  ) {
    await this.svc.resolveQueueEntry(
      req.tenantDb,
      id,
      body.resolution,
      body.resolvedBy,
      body.note,
    );
    return { ok: true };
  }
}
