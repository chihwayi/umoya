import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MaternalMortalityService } from '../services/maternal-mortality.service';

@ApiTags('Maternal Mortality & EmONC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maternal-mortality')
export class MaternalMortalityController {
  constructor(private readonly maternalMortalityService: MaternalMortalityService) {}

  @Post('deaths')
  @ApiOperation({ summary: 'Report a maternal death or near-miss and return audit guidance' })
  reportDeath(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.maternalMortalityService.reportDeath(req.tenantId!, user?.userId ?? user?.id, body);
  }

  @Get('deaths')
  @ApiOperation({ summary: 'List maternal deaths and near-miss records' })
  listDeaths(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('reviewStatus') reviewStatus: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.maternalMortalityService.listDeaths(req.tenantId!, { from, to, reviewStatus });
  }

  @Patch('deaths/:id/review-status')
  @ApiOperation({ summary: 'Update maternal death review status' })
  updateReviewStatus(
    @Param('id') id: string,
    @Body('reviewStatus') reviewStatus: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.maternalMortalityService.updateDeathReviewStatus(req.tenantId!, id, reviewStatus);
  }

  @Post('deaths/:deathId/reviews')
  @ApiOperation({ summary: 'Create a maternal death case review' })
  createReview(
    @Param('deathId') deathId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.maternalMortalityService.createReview(req.tenantId!, user?.userId ?? user?.id, {
      ...body,
      maternalDeathId: deathId,
    });
  }

  @Get('deaths/:deathId/reviews')
  @ApiOperation({ summary: 'Get reviews for a maternal death record' })
  getReviews(@Param('deathId') deathId: string, @Request() req: RequestWithTenant) {
    return this.maternalMortalityService.getReviews(req.tenantId!, deathId);
  }

  @Post('emonc')
  @ApiOperation({ summary: 'Record an EmONC assessment and return classification' })
  recordEmoncAssessment(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.maternalMortalityService.recordEmoncAssessment(req.tenantId!, user?.userId ?? user?.id, body);
  }

  @Get('emonc/latest')
  @ApiOperation({ summary: 'Get the latest EmONC assessment for the tenant or facility' })
  getLatestEmoncAssessment(
    @Query('facilityId') facilityId: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.maternalMortalityService.getLatestEmoncAssessment(req.tenantId!, facilityId);
  }

  @Get('emonc/history')
  @ApiOperation({ summary: 'Get historical EmONC assessments' })
  getEmoncHistory(
    @Query('facilityId') facilityId: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.maternalMortalityService.getEmoncHistory(req.tenantId!, facilityId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get maternal mortality dashboard summary for a year' })
  getSummary(@Query('year') year: string | undefined, @Request() req: RequestWithTenant) {
    const parsedYear = Number.parseInt(year || '', 10);
    return this.maternalMortalityService.getMortalitySummary(
      req.tenantId!,
      Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear(),
    );
  }
}
