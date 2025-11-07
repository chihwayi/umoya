import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LabTestCatalogService } from '../services/lab-test-catalog.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Lab Test Catalog')
@Controller('lab/test-catalog')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LabTestCatalogController {
  constructor(private readonly labTestCatalogService: LabTestCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Get all lab tests from catalog' })
  @ApiResponse({ status: 200, description: 'List of all lab tests' })
  async getAllTests(
    @Request() req: RequestWithTenant,
    @Query('category') category?: string,
    @Query('active') active?: boolean,
  ) {
    return this.labTestCatalogService.getAllTests(req.tenantDb, { category, active });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search tests by name or code' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchTests(
    @Request() req: RequestWithTenant,
    @Query('q') query: string,
  ) {
    return this.labTestCatalogService.searchTests(req.tenantDb, query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all test categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories(@Request() req: RequestWithTenant) {
    return this.labTestCatalogService.getCategories(req.tenantDb);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get tests by category' })
  @ApiResponse({ status: 200, description: 'Tests in category' })
  async getTestsByCategory(
    @Request() req: RequestWithTenant,
    @Param('category') category: string,
  ) {
    return this.labTestCatalogService.getTestsByCategory(req.tenantDb, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get test details with components' })
  @ApiResponse({ status: 200, description: 'Test details' })
  async getTestById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labTestCatalogService.getTestById(req.tenantDb, id);
  }

  @Get(':id/components')
  @ApiOperation({ summary: 'Get test components with reference ranges' })
  @ApiResponse({ status: 200, description: 'Test components' })
  async getTestComponents(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labTestCatalogService.getTestComponents(req.tenantDb, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new lab test' })
  @ApiResponse({ status: 201, description: 'Test created successfully' })
  async createTest(
    @Request() req: RequestWithTenant,
    @Body() testData: any,
  ) {
    return this.labTestCatalogService.createTest(req.tenantDb, testData);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lab test' })
  @ApiResponse({ status: 200, description: 'Test updated successfully' })
  async updateTest(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() testData: any,
  ) {
    return this.labTestCatalogService.updateTest(req.tenantDb, id, testData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate lab test' })
  @ApiResponse({ status: 200, description: 'Test deactivated successfully' })
  async deactivateTest(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labTestCatalogService.deactivateTest(req.tenantDb, id);
  }

  @Post(':id/components')
  @ApiOperation({ summary: 'Add component to test' })
  @ApiResponse({ status: 201, description: 'Component added successfully' })
  async addComponent(
    @Request() req: RequestWithTenant,
    @Param('id') testId: string,
    @Body() componentData: any,
  ) {
    return this.labTestCatalogService.addComponent(req.tenantDb, testId, componentData);
  }

  @Patch('components/:componentId')
  @ApiOperation({ summary: 'Update test component' })
  @ApiResponse({ status: 200, description: 'Component updated successfully' })
  async updateComponent(
    @Request() req: RequestWithTenant,
    @Param('componentId') componentId: string,
    @Body() componentData: any,
  ) {
    return this.labTestCatalogService.updateComponent(req.tenantDb, componentId, componentData);
  }

  @Post('components/:componentId/reference-ranges')
  @ApiOperation({ summary: 'Add age/gender specific reference range' })
  @ApiResponse({ status: 201, description: 'Reference range added successfully' })
  async addReferenceRange(
    @Request() req: RequestWithTenant,
    @Param('componentId') componentId: string,
    @Body() rangeData: any,
  ) {
    return this.labTestCatalogService.addReferenceRange(req.tenantDb, componentId, rangeData);
  }
}

