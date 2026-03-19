import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NurseTaskService, CreateNurseTaskDto, UpdateNurseTaskDto } from '../services/nurse-task.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Nurse Tasks & Care Gaps')
@ApiBearerAuth()
@Controller('nurse-tasks')
@UseGuards(JwtAuthGuard)
export class NurseTaskController {
  constructor(private readonly nurseTaskService: NurseTaskService) {}

  // ── Nurse Task endpoints ──────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a nurse task manually' })
  @ApiResponse({ status: 201 })
  async createTask(@Body() dto: CreateNurseTaskDto, @Request() req: RequestWithTenant) {
    return this.nurseTaskService.createTask(dto, req.tenantDb);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending tasks for the tenant (nurse worklist)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getPendingTasks(@Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.nurseTaskService.getPendingTasks(req!.tenantDb, limit ? parseInt(limit, 10) : 50);
  }

  @Get('nurse/:nurseId')
  @ApiOperation({ summary: 'Get tasks assigned to a specific nurse' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200 })
  async getTasksForNurse(
    @Param('nurseId') nurseId: string,
    @Query('status') status?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.nurseTaskService.getTasksForNurse(nurseId, req!.tenantDb, status);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all tasks for a patient' })
  @ApiResponse({ status: 200 })
  async getTasksForPatient(
    @Param('patientId') patientId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.nurseTaskService.getTasksForPatient(patientId, req.tenantDb);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a nurse task (status, assignment, completion)' })
  @ApiResponse({ status: 200 })
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateNurseTaskDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.nurseTaskService.updateTask(id, dto, req.tenantDb);
  }

  // ── Care Gap endpoints ────────────────────────────────────────────────────

  @Get('care-gaps/patient/:patientId')
  @ApiOperation({ summary: 'Get care gap detections for a patient' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200 })
  async getCareGaps(
    @Param('patientId') patientId: string,
    @Query('status') status?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.nurseTaskService.getCareGapsForPatient(patientId, req!.tenantDb, status);
  }

  @Patch('care-gaps/:id/status')
  @ApiOperation({ summary: 'Update care gap status (resolved / deferred / patient_declined)' })
  @ApiResponse({ status: 200 })
  async updateCareGapStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.nurseTaskService.updateCareGapStatus(id, body.status, req.tenantDb);
  }
}
