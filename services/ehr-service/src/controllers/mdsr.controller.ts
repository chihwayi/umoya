import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MdsrService } from '../services/mdsr.service';

@Controller('tenants/:tenantId/mdsr')
@UseGuards(JwtAuthGuard)
export class MdsrController {
  constructor(private readonly mdsrService: MdsrService) {}

  @Post('deaths')
  recordDeath(
    @Param('tenantId') tenantId: string,
    @Body() dto: any,
  ) {
    return this.mdsrService.recordMaternalDeath(tenantId, dto.delivery_id, dto);
  }

  @Post('reviews')
  createReview(@Param('tenantId') tenantId: string, @Body() dto: any) {
    return this.mdsrService.saveMdsrReview(tenantId, dto);
  }

  @Put('reviews/:reviewId')
  updateReview(
    @Param('tenantId') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: any,
  ) {
    return this.mdsrService.saveMdsrReview(tenantId, { ...dto, id: reviewId });
  }

  @Get('reviews/:reviewId')
  getReview(@Param('tenantId') tenantId: string, @Param('reviewId') reviewId: string) {
    return this.mdsrService.getReviewDetails(tenantId, reviewId);
  }

  @Post('reviews/:reviewId/actions')
  addAction(
    @Param('tenantId') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: any,
  ) {
    return this.mdsrService.addActionItem(tenantId, reviewId, dto);
  }

  @Put('actions/:actionId')
  updateAction(
    @Param('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
    @Body() dto: any,
  ) {
    return this.mdsrService.updateActionItem(tenantId, actionId, dto);
  }

  @Get('summary')
  getSummary(@Param('tenantId') tenantId: string, @Query('year') year: string) {
    return this.mdsrService.getMdsrSummary(tenantId, Number(year) || new Date().getFullYear());
  }

  @Get('deaths')
  getDeaths(@Param('tenantId') tenantId: string, @Query('year') year: string) {
    return this.mdsrService.getDeathsRegister(tenantId, Number(year) || new Date().getFullYear());
  }

  @Get('actions/overdue')
  getOverdue(@Param('tenantId') tenantId: string) {
    return this.mdsrService.getOverdueActionItems(tenantId);
  }

  @Get('mohcc-report')
  getMohccReport(
    @Param('tenantId') tenantId: string,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
  ) {
    return this.mdsrService.generateMohccReport(
      tenantId,
      Number(year) || new Date().getFullYear(),
      Number(quarter) || Math.ceil((new Date().getMonth() + 1) / 3),
    );
  }
}
