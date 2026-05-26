import { Controller, Get, Post, Body, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { randomBytes } from 'crypto';

@ApiTags('Research Day')
@Controller('research-day')
export class ResearchDayController {
  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a time-limited Research Day access session' })
  async createSession(
    @Body() body: { sessionName: string; validFrom: string; validUntil: string; allowedViews: string[] },
    @Req() req: any,
  ) {
    const token = randomBytes(32).toString('hex');
    const [row] = await req.tenantDb.query(
      `INSERT INTO research_day_sessions
         (session_name, access_token, created_by, valid_from, valid_until, allowed_views)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.sessionName, token, req.user.sub, body.validFrom, body.validUntil, body.allowedViews],
    );
    return { ...row, shareUrl: `/research-day/view?token=${token}` };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all research day sessions created by this user' })
  async listSessions(@Req() req: any) {
    return req.tenantDb.query(
      `SELECT * FROM research_day_sessions WHERE created_by = $1 ORDER BY created_at DESC`,
      [req.user.sub],
    );
  }

  @Get('view')
  @ApiOperation({ summary: 'Public research day dashboard (token-gated, no login required)' })
  async viewDashboard(@Query('token') token: string, @Query('view') view: string, @Req() req: any) {
    if (!token) throw new UnauthorizedException('Access token required.');

    const [session] = await req.tenantDb.query(
      `SELECT * FROM research_day_sessions
       WHERE access_token = $1 AND valid_from <= now() AND valid_until >= now()`,
      [token],
    );
    if (!session) throw new UnauthorizedException('Invalid or expired research day token.');
    if (!session.allowed_views.includes(view)) {
      throw new UnauthorizedException(`View '${view}' not permitted for this session.`);
    }

    await req.tenantDb.query(
      `UPDATE research_day_sessions SET access_count = access_count + 1 WHERE id = $1`,
      [session.id],
    );

    switch (view) {
      case 'cascade': {
        const rows = await req.tenantDb.query(`SELECT * FROM cascade_snapshots ORDER BY snapshot_date DESC LIMIT 4`);
        return { sessionName: session.session_name, validUntil: session.valid_until, view: 'cascade', data: rows };
      }
      case 'retention': {
        const rows = await req.tenantDb.query(`SELECT * FROM retention_snapshots ORDER BY cohort_start DESC LIMIT 12`);
        return { sessionName: session.session_name, validUntil: session.valid_until, view: 'retention', data: rows };
      }
      case 'pharmacovigilance': {
        const rows = await req.tenantDb.query(`
          SELECT suspect_drug, event_severity, event_outcome, causality, COUNT(*) AS case_count
          FROM art_adverse_events
          GROUP BY suspect_drug, event_severity, event_outcome, causality
          ORDER BY case_count DESC`);
        return { sessionName: session.session_name, validUntil: session.valid_until, view: 'pharmacovigilance', data: rows };
      }
      default:
        throw new UnauthorizedException('Unknown view.');
    }
  }
}
