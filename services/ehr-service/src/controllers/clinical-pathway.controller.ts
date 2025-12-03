import {
  Controller,
  Get,
  Post,
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
import { ClinicalPathwayService } from '../services/clinical-pathway.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Clinical Pathways')
@ApiBearerAuth()
@Controller('clinical-pathways')
@UseGuards(JwtAuthGuard)
export class ClinicalPathwayController {
  constructor(
    private readonly pathwayService: ClinicalPathwayService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get clinical pathways' })
  async getPathways(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.pathwayService.getPathways(filters, tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pathway by ID' })
  async getPathwayById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.pathwayService.getPathwayById(id, tenantDb);
  }

  @Post('enroll')
  @ApiOperation({ summary: 'Enroll patient in pathway' })
  async enrollPatient(@Body() enrollData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.pathwayService.enrollPatient(
      enrollData.pathwayId,
      enrollData.patientId,
      enrollData.admissionId,
      req.user.userId,
      tenantDb,
    );
  }

  @Get('patient/:patientId/enrollments')
  @ApiOperation({ summary: 'Get patient pathway enrollments' })
  async getPatientEnrollments(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.pathwayService.getPatientEnrollments(patientId, tenantDb);
  }

  @Post('enrollments/:id/adherence')
  @ApiOperation({ summary: 'Track pathway adherence' })
  @HttpCode(HttpStatus.OK)
  async trackAdherence(
    @Param('id') enrollmentId: string,
    @Body() body: { stepId: string; completed: boolean },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    await this.pathwayService.trackAdherence(
      enrollmentId,
      body.stepId,
      body.completed,
      req.user.userId,
      tenantDb,
    );
    return { message: 'Adherence tracked successfully' };
  }
}

