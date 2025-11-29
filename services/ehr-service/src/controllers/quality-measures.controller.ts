import { Controller, Get, Post, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { QualityMeasuresService, QualityMeasureType, MeasureCategory } from '../services/quality-measures.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Quality Measures')
@ApiBearerAuth()
@Controller('quality-measures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityMeasuresController {
  constructor(private readonly qualityMeasuresService: QualityMeasuresService) {}

  @Get('measures')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get all available quality measures' })
  @ApiQuery({ name: 'type', description: 'Filter by measure type (hedis/ecqm/custom)', required: false })
  @ApiQuery({ name: 'category', description: 'Filter by category', required: false })
  @ApiResponse({ status: 200, description: 'Quality measures retrieved successfully' })
  async getMeasures(
    @Query('type') type?: QualityMeasureType,
    @Query('category') category?: MeasureCategory,
  ) {
    if (type) {
      return this.qualityMeasuresService.getMeasuresByType(type);
    }
    if (category) {
      return this.qualityMeasuresService.getMeasuresByCategory(category);
    }
    return this.qualityMeasuresService.getAllMeasures();
  }

  @Get('measures/:measureId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get a specific quality measure' })
  @ApiParam({ name: 'measureId', description: 'Measure ID', required: true })
  @ApiResponse({ status: 200, description: 'Quality measure retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Measure not found' })
  async getMeasure(@Param('measureId') measureId: string) {
    const measure = this.qualityMeasuresService.getMeasureById(measureId);
    if (!measure) {
      throw new Error(`Measure ${measureId} not found`);
    }
    return measure;
  }

  @Post('calculate/:measureId')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Calculate a specific quality measure' })
  @ApiParam({ name: 'measureId', description: 'Measure ID', required: true })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: true })
  @ApiQuery({ name: 'save', description: 'Save result to database', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Measure calculated successfully' })
  async calculateMeasure(
    @Request() req: RequestWithTenant,
    @Param('measureId') measureId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('save') save?: string,
  ) {
    const result = await this.qualityMeasuresService.calculateMeasure(
      req.tenantDb,
      measureId,
      new Date(startDate),
      new Date(endDate),
    );

    if (save === 'true' || save === '1') {
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      await this.qualityMeasuresService.saveMeasureResult(req.tenantDb, result, userId);
    }

    return result;
  }

  @Post('calculate')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Calculate multiple quality measures' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: true })
  @ApiQuery({ name: 'save', description: 'Save results to database', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Measures calculated successfully' })
  async calculateMeasures(
    @Request() req: RequestWithTenant,
    @Body() body: { measureIds: string[] },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('save') save?: string,
  ) {
    const results = await this.qualityMeasuresService.calculateMeasures(
      req.tenantDb,
      body.measureIds,
      new Date(startDate),
      new Date(endDate),
    );

    if (save === 'true' || save === '1') {
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      await Promise.all(
        results.map((result) =>
          this.qualityMeasuresService.saveMeasureResult(req.tenantDb, result, userId),
        ),
      );
    }

    return results;
  }

  @Get('results')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get quality measure results history' })
  @ApiQuery({ name: 'measureId', description: 'Filter by measure ID', required: false })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false, type: Number })
  @ApiQuery({ name: 'offset', description: 'Offset for pagination', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getResults(
    @Request() req: RequestWithTenant,
    @Query('measureId') measureId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.qualityMeasuresService.getMeasureResults(req.tenantDb, {
      measureId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get quality measures dashboard summary' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: true })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved successfully' })
  async getDashboard(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.qualityMeasuresService.getQualityDashboard(
      req.tenantDb,
      new Date(startDate),
      new Date(endDate),
    );
  }
}


