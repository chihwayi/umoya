import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EncounterCodingService } from '../services/encounter-coding.service';

@ApiTags('Encounter Coding')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class EncounterCodingController {
  constructor(private readonly encodingService: EncounterCodingService) {}

  @Post('post-visit/sessions/:id/suggest-codes')
  @ApiOperation({ summary: 'Generate ICD-10/CPT code suggestions from post-visit session' })
  async suggestCodesFromSession(
    @Request() req: RequestWithTenant,
    @Param('id') sessionId: string,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const sessionRow = await req.tenantDb.query(
      `SELECT patient_id FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    const patientId = sessionRow?.[0]?.patient_id;
    if (!patientId) {
      return { error: 'Session not found or missing patient_id' };
    }
    return this.encodingService.suggestEncounterCodes(
      req.tenantDb,
      sessionId,
      null,
      patientId,
      userId,
    );
  }

  @Post('encounters/:appointmentId/suggest-codes')
  @ApiOperation({ summary: 'Generate ICD-10/CPT code suggestions from appointment/encounter' })
  async suggestCodesFromAppointment(
    @Request() req: RequestWithTenant,
    @Param('appointmentId') appointmentId: string,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const apptRow = await req.tenantDb.query(
      `SELECT patient_id FROM appointments WHERE id = $1 LIMIT 1`,
      [appointmentId],
    );
    const patientId = apptRow?.[0]?.patient_id;
    if (!patientId) {
      return { error: 'Appointment not found or missing patient_id' };
    }
    return this.encodingService.suggestEncounterCodes(
      req.tenantDb,
      null,
      appointmentId,
      patientId,
      userId,
    );
  }

  @Put('encounter-codes/:id/review')
  @ApiOperation({ summary: 'Accept or reject encounter code suggestions' })
  async reviewCodes(
    @Request() req: RequestWithTenant,
    @Param('id') suggestionId: string,
    @Body() body: { acceptedCodes: string[]; rejectedCodes: string[] },
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.encodingService.reviewEncounterCodes(req.tenantDb, suggestionId, body, userId);
  }

  @Get('post-visit/sessions/:id/encounter-codes')
  @ApiOperation({ summary: 'Get encounter code suggestions for a session' })
  async getSessionCodes(
    @Request() req: RequestWithTenant,
    @Param('id') sessionId: string,
  ) {
    const rows = await this.encodingService.getSuggestionsForSession(req.tenantDb, sessionId);
    return { suggestions: rows };
  }
}
