import {
  Controller,
  Get,
  Post,
  Put,
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
import { BedManagementService } from '../services/bed-management.service';
import { ADTService } from '../services/adt.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Bed Management & ADT')
@ApiBearerAuth()
@Controller('beds')
@UseGuards(JwtAuthGuard)
export class BedManagementController {
  constructor(
    private readonly bedManagementService: BedManagementService,
    private readonly adtService: ADTService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all beds with filters' })
  async getBeds(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.getBeds(filters, tenantDb);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available beds' })
  async getAvailableBeds(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.getAvailableBeds(
      filters.bedType,
      filters.wardName,
      tenantDb,
    );
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign bed to patient' })
  @HttpCode(HttpStatus.OK)
  async assignBed(
    @Param('id') bedId: string,
    @Body() body: { patientId: string; admissionId: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.assignBed(
      bedId,
      body.patientId,
      body.admissionId,
      req.user.userId,
      tenantDb,
    );
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Release bed' })
  @HttpCode(HttpStatus.OK)
  async releaseBed(
    @Param('id') bedId: string,
    @Body() body: { reason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.releaseBed(bedId, req.user.userId, body.reason, tenantDb);
  }

  @Post(':id/cleaned')
  @ApiOperation({ summary: 'Mark bed as cleaned' })
  @HttpCode(HttpStatus.OK)
  async markBedCleaned(@Param('id') bedId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.markBedCleaned(bedId, req.user.userId, tenantDb);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Get bed occupancy statistics' })
  async getBedOccupancy(@Query('wardName') wardName: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.getBedOccupancy(wardName, tenantDb);
  }

  @Get('wards')
  @ApiOperation({ summary: 'Get list of wards' })
  async getWards(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.bedManagementService.getWardsList(tenantDb);
  }

  // ADT Endpoints
  @Post('admissions')
  @ApiOperation({ summary: 'Admit patient' })
  async admitPatient(@Body() admissionData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.adtService.admitPatient(admissionData, req.user.userId, tenantDb);
  }

  @Post('admissions/:id/discharge')
  @ApiOperation({ summary: 'Discharge patient' })
  @HttpCode(HttpStatus.OK)
  async dischargePatient(
    @Param('id') admissionId: string,
    @Body() dischargeData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.adtService.dischargePatient(admissionId, dischargeData, req.user.userId, tenantDb);
  }

  @Post('admissions/:id/transfer')
  @ApiOperation({ summary: 'Transfer patient' })
  @HttpCode(HttpStatus.OK)
  async transferPatient(
    @Param('id') admissionId: string,
    @Body() transferData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.adtService.transferPatient(admissionId, transferData, req.user.userId, tenantDb);
  }

  // Specific routes must come before general routes
  @Get('admissions/patient/:patientId')
  @ApiOperation({ summary: 'Get admissions for a patient' })
  async getPatientAdmissions(
    @Param('patientId') patientId: string,
    @Query('includeDischarged') includeDischarged: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const includeDischargedBool = includeDischarged === 'true';
    return await this.adtService.getPatientAdmissions(patientId, tenantDb, includeDischargedBool);
  }

  @Get('admissions')
  @ApiOperation({ summary: 'Get active admissions' })
  async getActiveAdmissions(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.adtService.getActiveAdmissions(filters, tenantDb);
  }

  @Get('census')
  @ApiOperation({ summary: 'Get census snapshot' })
  async getCensus(@Query('wardName') wardName: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.adtService.getCensusSnapshot(wardName, tenantDb);
  }
}

