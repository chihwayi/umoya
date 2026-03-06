import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { HipaaAuditService } from '../services/hipaa-audit.service';

@ApiTags('Admin Audit')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

  @Get('disclosure-report')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Generate HIPAA accounting of disclosures report for one patient' })
  @ApiQuery({ name: 'patientId', required: true, description: 'Patient ID' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Disclosure report generated' })
  async getDisclosureReport(
    @Request() req: RequestWithTenant,
    @Query('patientId') patientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const normalizedPatientId = String(patientId || '').trim();
    if (!normalizedPatientId) {
      throw new BadRequestException('patientId is required');
    }

    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }

    return this.hipaaAuditService.getDisclosureReport(
      req.tenantDb,
      normalizedPatientId,
      startDate,
      endDate,
    );
  }
}

