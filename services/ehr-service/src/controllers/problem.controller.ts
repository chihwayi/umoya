import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProblemService } from '../services/problem.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('problems')
export class ProblemController {
  constructor(private problemService: ProblemService) {}

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.problemService.findByPatient(patientId, req.tenantId);
  }

  @Put('patient/:patientId')
  async replaceForPatient(@Param('patientId') patientId: string, @Body() body: { problems: any[] }, @Request() req: RequestWithTenant) {
    return this.problemService.replaceForPatient(patientId, body?.problems || [], req.tenantId);
  }
}


