import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ImmunizationService } from '../services/immunization.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Immunizations')
@ApiBearerAuth()
@Controller('immunizations')
@UseGuards(JwtAuthGuard)
export class ImmunizationController {
  constructor(
    private readonly immunizationService: ImmunizationService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('report/coverage')
  @ApiOperation({ summary: 'Get immunization coverage report by antigen and optional age group' })
  async getCoverageReport(
    @Query('periodStart') periodStart: string | undefined,
    @Query('periodEnd') periodEnd: string | undefined,
    @Query('antigen') antigen: string | undefined,
    @Query('ageGroup') ageGroup: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.immunizationService.getCoverageReport(tenantDb, {
      periodStart,
      periodEnd,
      antigen,
      ageGroup: ageGroup === 'false' || ageGroup === '0' ? 'none' : ageGroup,
    });
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get immunization schedules (routine and/or travel)' })
  async getSchedules(
    @Query('scheduleType') scheduleType: 'routine' | 'travel' | undefined,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.getSchedules(tenantDb, scheduleType);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get vaccine inventory' })
  async getInventory(
    @Query('vaccineCode') vaccineCode: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.getInventory(tenantDb, vaccineCode);
  }

  @Post('administer')
  @ApiOperation({ summary: 'Administer vaccine (legacy — patientId in body)' })
  async administerVaccine(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.administerVaccine(body, userId, tenantDb);
  }

  @Post('patient/:patientId/administer')
  @ApiOperation({ summary: 'Administer vaccine to patient (patientId in path)' })
  async administerVaccineForPatient(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.administerVaccine({ ...body, patientId }, userId, tenantDb);
  }

  @Post()
  @ApiOperation({ summary: 'Record vaccine administration' })
  async recordImmunization(@Body() immunizationData: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.recordImmunization(immunizationData, userId, tenantDb);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient immunization history' })
  async getPatientImmunizations(
    @Param('patientId') patientId: string,
    @Query() filters: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.getPatientImmunizations(patientId, filters, tenantDb);
  }

  @Get('patient/:patientId/forecast')
  @ApiOperation({ summary: 'Get immunization forecast for patient' })
  async getImmunizationForecast(
    @Param('patientId') patientId: string,
    @Query('dateOfBirth') dateOfBirth: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.immunizationService.getImmunizationForecast(
      patientId,
      new Date(dateOfBirth),
      tenantDb,
    );
  }

  @Post(':id/adverse-event')
  @ApiOperation({ summary: 'Record adverse event' })
  @HttpCode(HttpStatus.OK)
  async recordAdverseEvent(
    @Param('id') id: string,
    @Body() eventData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    await this.immunizationService.recordAdverseEvent(id, eventData, req.user.userId, tenantDb);
    return { message: 'Adverse event recorded successfully' };
  }
}

