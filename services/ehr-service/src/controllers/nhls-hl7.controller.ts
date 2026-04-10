import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NhlsHl7Service } from '../services/nhls-hl7.service';

@Controller('nhls')
export class NhlsHl7Controller {
  constructor(private readonly nhlsHl7Service: NhlsHl7Service) {}

  @Post('hl7/ingest')
  ingest(@Body() body: any, @Request() req: RequestWithTenant) {
    const rawHl7 = typeof body === 'string' ? body : body?.hl7 || '';
    return this.nhlsHl7Service.ingestHl7(req.tenantId, rawHl7);
  }

  @Get('results/pending')
  @UseGuards(JwtAuthGuard)
  getPending(@Request() req: RequestWithTenant) {
    return this.nhlsHl7Service.getPendingResults(req.tenantId);
  }

  @Get('results/:patientId')
  @UseGuards(JwtAuthGuard)
  getResultsByPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nhlsHl7Service.getResultsByPatient(req.tenantId, patientId);
  }

  @Patch('results/:id/link')
  @UseGuards(JwtAuthGuard)
  linkResult(@Param('id') id: string, @Body() body: { patientId: string }, @Request() req: RequestWithTenant) {
    return this.nhlsHl7Service.linkResultToPatient(req.tenantId, id, body.patientId);
  }
}
