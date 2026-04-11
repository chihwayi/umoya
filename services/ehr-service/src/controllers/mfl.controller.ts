import { Controller, Get, Post, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MflService } from '../services/mfl.service';

@Controller('mfl')
@UseGuards(JwtAuthGuard)
export class MflController {
  constructor(private readonly mflService: MflService) {}

  @Post('sync')
  syncFacilities(@Request() req: RequestWithTenant) {
    return this.mflService.syncFacilities(req.tenantId);
  }

  @Get('facilities')
  getFacilities(
    @Query('county') county: string,
    @Query('facilityType') facilityType: string,
    @Query('search') search: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Request() req: RequestWithTenant,
  ) {
    return this.mflService.getFacilities(req.tenantId, {
      county,
      facilityType,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('facilities/:mflCode')
  getFacilityByMflCode(@Param('mflCode') mflCode: string, @Request() req: RequestWithTenant) {
    return this.mflService.getFacilityByMflCode(req.tenantId, mflCode);
  }
}
