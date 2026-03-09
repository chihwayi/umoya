import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CdiService } from '../services/cdi.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Clinical Documentation Improvement')
@ApiBearerAuth()
@Controller('cdi')
@UseGuards(JwtAuthGuard)
export class CdiController {
  constructor(
    private readonly cdiService: CdiService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('reviews')
  @ApiOperation({ summary: 'Create CDI review' })
  @ApiResponse({ status: 201, description: 'CDI review created' })
  async createCdiReview(
    @Body() reviewData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.cdiService.createCdiReview(reviewData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Post('queries')
  @ApiOperation({ summary: 'Send physician query' })
  @ApiResponse({ status: 201, description: 'Query sent' })
  async sendPhysicianQuery(
    @Body() queryData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.cdiService.sendPhysicianQuery(queryData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('queries/physician/:physicianId')
  @ApiOperation({ summary: 'Get open queries for physician' })
  @ApiResponse({ status: 200, description: 'Queries retrieved' })
  async getOpenQueries(
    @Param('physicianId') physicianId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.cdiService.getOpenQueries(physicianId, tenantDb);
  }

  @Put('queries/:id/answer')
  @ApiOperation({ summary: 'Answer physician query' })
  @ApiResponse({ status: 200, description: 'Query answered' })
  async answerQuery(
    @Param('id') id: string,
    @Body() responseData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.cdiService.answerQuery(id, responseData, tenantDb);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get CDI metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved' })
  async getCdiMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.cdiService.getCdiMetrics(start, end, tenantDb);
  }
}




