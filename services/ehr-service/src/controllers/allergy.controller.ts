import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AllergyService } from '../services/allergy.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('allergies')
export class AllergyController {
  constructor(private allergyService: AllergyService) {}

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.allergyService.findByPatient(patientId, req.tenantId);
  }

  @Put('patient/:patientId')
  async replaceForPatient(@Param('patientId') patientId: string, @Body() body: { allergies: any[] }, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.id;
    return this.allergyService.replaceForPatient(patientId, body?.allergies || [], userId, req.tenantId);
  }
}


