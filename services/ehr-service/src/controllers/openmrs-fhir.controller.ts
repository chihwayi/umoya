import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OpenmrsFhirService } from '../services/openmrs-fhir.service';

@Controller('openmrs')
@UseGuards(JwtAuthGuard)
export class OpenmrsFhirController {
  constructor(private readonly openmrsFhirService: OpenmrsFhirService) {}

  @Post('link')
  linkPatient(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.openmrsFhirService.linkPatient(
      req.tenantId,
      body.patientId,
      body.openmrsUuid,
      body.openmrsBaseUrl,
    );
  }

  @Post(':patientId/push')
  pushPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.openmrsFhirService.pushPatientToOpenmrs(req.tenantId, patientId);
  }

  @Get(':patientId/pull')
  pullPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.openmrsFhirService.pullPatientFromOpenmrs(req.tenantId, patientId);
  }

  @Get('links')
  getLinks(@Query('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.openmrsFhirService.getLinks(req.tenantId, patientId);
  }

  @Get('sync-logs')
  getSyncLogs(
    @Query('patientId') patientId: string,
    @Query('direction') direction: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Request() req: RequestWithTenant,
  ) {
    return this.openmrsFhirService.getSyncLogs(req.tenantId, {
      patientId,
      direction,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
