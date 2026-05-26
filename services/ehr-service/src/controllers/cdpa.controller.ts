import { Body, Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

interface UpdateCdpaControlDto {
  status?: string;
  evidenceUrl?: string | null;
  evidenceNotes?: string | null;
  owner?: string | null;
  lastReviewed?: string | null;
  nextReview?: string | null;
}

@ApiTags('CDPA Compliance')
@ApiBearerAuth()
@Controller('cdpa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CdpaController {
  @Get('controls')
  @Roles('admin')
  async getControls(@Request() req: RequestWithTenant) {
    return req.tenantDb.query('SELECT * FROM cdpa_controls ORDER BY control_id ASC');
  }

  @Get('controls/summary')
  @Roles('admin')
  async getSummary(@Request() req: RequestWithTenant) {
    const [row] = await req.tenantDb.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'compliant') AS compliant,
        COUNT(*) FILTER (WHERE status = 'partial') AS partial,
        COUNT(*) FILTER (WHERE status = 'non_compliant') AS non_compliant,
        COUNT(*) FILTER (WHERE status = 'not_assessed') AS not_assessed,
        COUNT(*) FILTER (WHERE status = 'not_applicable') AS not_applicable
      FROM cdpa_controls
    `);

    return {
      total: Number(row?.total || 0),
      compliant: Number(row?.compliant || 0),
      partial: Number(row?.partial || 0),
      nonCompliant: Number(row?.non_compliant || 0),
      notAssessed: Number(row?.not_assessed || 0),
      notApplicable: Number(row?.not_applicable || 0),
    };
  }

  @Patch('controls/:id')
  @Roles('admin')
  async updateControl(
    @Param('id') id: string,
    @Body() body: UpdateCdpaControlDto,
    @Request() req: RequestWithTenant,
  ) {
    await req.tenantDb.query(
      `
        UPDATE cdpa_controls
        SET status = COALESCE($1, status),
            evidence_url = COALESCE($2, evidence_url),
            evidence_notes = COALESCE($3, evidence_notes),
            owner = COALESCE($4, owner),
            last_reviewed = COALESCE($5::DATE, last_reviewed),
            next_review = COALESCE($6::DATE, next_review),
            updated_at = NOW()
        WHERE id = $7
      `,
      [
        body.status ?? null,
        body.evidenceUrl ?? null,
        body.evidenceNotes ?? null,
        body.owner ?? null,
        body.lastReviewed ?? null,
        body.nextReview ?? null,
        id,
      ],
    );

    const [row] = await req.tenantDb.query('SELECT * FROM cdpa_controls WHERE id = $1', [id]);
    return row;
  }
}
