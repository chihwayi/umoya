import { Controller, Post, Put, Get, Query, Body, Param, Req, UseGuards, ConflictException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OfflineSyncService } from '../services/offline-sync.service';
import { ConflictResolverService } from '../services/conflict-resolver.service';

const ENTITY_TO_TABLE: Record<string, string> = {
  hiv_clinical_visits: 'hiv_clinical_visits',
  hiv_counselling_sessions: 'hiv_counselling_sessions',
  gbv_assessments: 'gbv_assessments',
  hiv_disclosure_records: 'hiv_disclosure_records',
  alhiv_transition_assessments: 'alhiv_transition_assessments',
  counsellor_sessions: 'counsellor_sessions',
  vitals: 'patient_vitals',
};

@Controller('sync')
export class OfflineSyncController {
  constructor(
    private readonly svc: OfflineSyncService,
    private readonly conflictResolver: ConflictResolverService,
  ) {}

  @Post('batch')
  processBatch(
    @Body('subdomain') subdomain: string,
    @Body('operations') operations: any[],
  ) {
    return this.svc.processBatch(subdomain, operations);
  }

  @Get('checkpoint')
  getCheckpoint(
    @Query('subdomain') subdomain: string,
    @Query('userId') userId: string,
    @Query('since') since: string,
  ) {
    return this.svc.getCheckpoint(subdomain, userId, since);
  }

  @Get('queue')
  getPendingQueue(
    @Query('subdomain') subdomain: string,
    @Query('clientId') clientId: string,
  ) {
    return this.svc.getPendingQueue(subdomain, clientId);
  }

  @Put(':entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  async syncEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() body: { payload: Record<string, unknown>; clientUpdatedAt: string },
    @Req() req: any,
  ) {
    const db = req.tenantDb;
    const table = ENTITY_TO_TABLE[entityType];
    if (!table) throw new ConflictException(`Unknown entity type: ${entityType}`);

    const rows = await db.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [entityId]);
    const serverRecord: Record<string, unknown> | undefined = rows[0];

    if (!serverRecord) {
      const keys = Object.keys(body.payload);
      const vals = Object.values(body.payload);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      await db.query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        vals,
      );
      return { resolution: 'inserted', merged: body.payload };
    }

    const { resolution, merged } = await this.conflictResolver.resolveConflict(
      entityType,
      entityId,
      body.payload,
      serverRecord,
      db,
    );

    if (resolution === 'rejected') {
      throw new ConflictException({ resolution: 'rejected', message: 'Entity is immutable' });
    }

    if (merged && (resolution === 'merge' || resolution === 'client_wins')) {
      const mergedKeys = Object.keys(merged).filter((k) => !['id', 'created_at'].includes(k));
      if (mergedKeys.length > 0) {
        const setClauses = mergedKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const vals = [...mergedKeys.map((k) => merged[k]), entityId];
        await db.query(`UPDATE ${table} SET ${setClauses} WHERE id = $${vals.length}`, vals);
      }
    }

    return { resolution, merged };
  }
}
