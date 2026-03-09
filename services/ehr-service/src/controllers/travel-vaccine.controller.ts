import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';
import { TravelVaccineService } from '../services/travel-vaccine.service';

@ApiTags('Travel Vaccines')
@ApiBearerAuth()
@Controller('travel-vaccines')
@UseGuards(JwtAuthGuard)
export class TravelVaccineController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly travelVaccineService: TravelVaccineService,
  ) {}

  @Get('destinations')
  @ApiOperation({ summary: 'List travel vaccine destinations (seeded)' })
  async listDestinations(@Query('search') search: string | undefined, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.travelVaccineService.listDestinations(tenantDb, search);
  }

  @Get('destinations/:isoCode')
  @ApiOperation({ summary: 'Get destination requirements by ISO code' })
  async getDestination(@Param('isoCode') isoCode: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.travelVaccineService.getDestinationRequirements(tenantDb, isoCode);
  }

  @Post('assess')
  @ApiOperation({ summary: 'Assess patient travel readiness vs destinations' })
  async assess(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.travelVaccineService.assessPatientTravelReadiness(
      tenantDb,
      body?.patientId,
      body?.destinations ?? [],
    );
  }

  @Post('yellow-card')
  @ApiOperation({ summary: 'Generate (record) Yellow Card certificate for patient' })
  async generateYellowCard(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.travelVaccineService.generateYellowCard(tenantDb, body?.patientId, userId, {
      issuingCenter: body?.issuingCenter,
      immunizationIds: body?.immunizationIds,
    });
  }
}

