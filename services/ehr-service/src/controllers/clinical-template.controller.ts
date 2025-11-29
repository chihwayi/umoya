import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClinicalTemplateService } from '../services/clinical-template.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Clinical Templates')
@ApiBearerAuth()
@Controller('clinical-templates')
@UseGuards(JwtAuthGuard)
export class ClinicalTemplateController {
  constructor(private readonly templateService: ClinicalTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clinical templates', description: 'Get all clinical note templates with optional filters' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'specialty', required: false, description: 'Filter by specialty' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'isDefault', required: false, description: 'Filter by default status' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  findAll(
    @Req() req: RequestWithTenant,
    @Query('category') category?: string,
    @Query('specialty') specialty?: string,
    @Query('isActive') isActive?: string,
    @Query('isDefault') isDefault?: string,
  ) {
    const filters: any = {};
    if (category) filters.category = category;
    if (specialty) filters.specialty = specialty;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isDefault !== undefined) filters.isDefault = isDefault === 'true';

    return this.templateService.findAll(req.tenantId, filters);
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Get default templates', description: 'Get all default clinical note templates' })
  @ApiResponse({ status: 200, description: 'Default templates retrieved successfully' })
  getDefaults(@Req() req: RequestWithTenant) {
    return this.templateService.getDefaults(req.tenantId);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get templates by category', description: 'Get all templates in a specific category' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  findByCategory(@Param('category') category: string, @Req() req: RequestWithTenant) {
    return this.templateService.findByCategory(category, req.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID', description: 'Get a specific clinical note template' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.templateService.findOne(id, req.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create template', description: 'Create a new clinical note template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  create(@Body() templateData: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.templateService.create(templateData, req.tenantId, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template', description: 'Update an existing clinical note template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(@Param('id') id: string, @Body() templateData: any, @Req() req: RequestWithTenant) {
    return this.templateService.update(id, templateData, req.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete template', description: 'Soft delete a clinical note template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  delete(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.templateService.delete(id, req.tenantId);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply template', description: 'Apply a template with variables to generate content' })
  @ApiResponse({ status: 200, description: 'Template applied successfully' })
  async applyTemplate(
    @Body() body: { templateId: string; variables?: Record<string, string>; context?: Record<string, any> },
    @Req() req: RequestWithTenant,
  ) {
    const content = await this.templateService.applyTemplate(
      body.templateId,
      body.variables || {},
      req.tenantId,
      body.context,
    );
    return { content };
  }
}

