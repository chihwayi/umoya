import { Controller, Get, Optional, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CdssService } from '../services/cdss.service';

@UseGuards(JwtAuthGuard)
@Controller('cdss')
export class CdssHealthController {
  constructor(@Optional() private readonly cdss: CdssService) {}

  @Get('health')
  async getHealth(): Promise<{
    status: string;
    latency: number | null;
    lastChecked: string;
    available: boolean;
  }> {
    if (!this.cdss) {
      return {
        status: 'not_configured',
        latency: null,
        lastChecked: new Date().toISOString(),
        available: false,
      };
    }

    const start = Date.now();
    try {
      await (this.cdss as any).ping?.();
      return {
        status: 'ok',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        available: true,
      };
    } catch {
      return {
        status: 'error',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        available: false,
      };
    }
  }

  @Get('abstentions')
  async getAbstentions(@Req() req: any): Promise<unknown[]> {
    return req.tenantDb.query(
      `SELECT context, reason, COUNT(*) as count
       FROM ai_abstention_log
       WHERE created_at > now() - INTERVAL '24 hours'
       GROUP BY context, reason
       ORDER BY count DESC`,
    );
  }
}
