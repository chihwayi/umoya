import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrescriptionTemplateService } from '../services/prescription-template.service';
import {
  CreatePrescriptionTemplateDto,
  UpdatePrescriptionTemplateDto,
} from '../dto/prescription-template.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PrescriptionTemplateCategory } from '../entities/prescription-template.entity';

@ApiTags('Prescription Templates')
@ApiBearerAuth()
@Controller('prescription-templates')
@UseGuards(JwtAuthGuard)
export class PrescriptionTemplateController {
  constructor(
    private readonly prescriptionTemplateService: PrescriptionTemplateService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List prescription templates' })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: PrescriptionTemplateCategory,
  })
  @ApiQuery({ name: 'specialty', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isDefault', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Request() req: RequestWithTenant,
    @Query('category') category?: PrescriptionTemplateCategory,
    @Query('specialty') specialty?: string,
    @Query('isActive') isActive?: string,
    @Query('isDefault') isDefault?: string,
    @Query('search') search?: string,
  ) {
    return this.prescriptionTemplateService.findAll(req.tenantDb, {
      category,
      specialty,
      isActive: this.parseBooleanQuery(isActive),
      isDefault: this.parseBooleanQuery(isDefault),
      search,
    });
  }

  @Get('defaults')
  @ApiOperation({ summary: 'List default templates' })
  @ApiResponse({ status: 200, description: 'Default templates returned' })
  async getDefaultTemplates(@Request() req: RequestWithTenant) {
    return this.prescriptionTemplateService.getDefaultTemplates(req.tenantDb);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'List templates for a category' })
  @ApiResponse({ status: 200, description: 'Templates returned' })
  async getByCategory(
    @Param('category') category: PrescriptionTemplateCategory,
    @Request() req: RequestWithTenant,
  ) {
    return this.prescriptionTemplateService.getByCategory(
      category,
      req.tenantDb,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template details' })
  @ApiResponse({ status: 200, description: 'Template returned' })
  async findOne(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.prescriptionTemplateService.findOne(id, req.tenantDb);
  }

  @Post()
  @ApiOperation({ summary: 'Create template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(
    @Body() body: CreatePrescriptionTemplateDto,
    @Request() req: RequestWithTenant,
  ) {
    const userId =
      ((req.user as any)?.id as string) || (req.user as any)?.userId || undefined;
    return this.prescriptionTemplateService.create(body, req.tenantDb, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePrescriptionTemplateDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.prescriptionTemplateService.update(id, body, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive template' })
  @ApiResponse({ status: 200, description: 'Template archived' })
  async remove(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.prescriptionTemplateService.delete(id, req.tenantDb);
    return { success: true };
  }

  private parseBooleanQuery(
    value?: string,
  ): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === 'true' || value === '1') {
      return true;
    }
    if (value === 'false' || value === '0') {
      return false;
    }
    return undefined;
  }
}

