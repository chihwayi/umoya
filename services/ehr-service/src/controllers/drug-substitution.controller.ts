import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DrugSubstitutionService } from '../services/drug-substitution.service';

@UseGuards(JwtAuthGuard)
@Controller('drug-substitution')
export class DrugSubstitutionController {
  constructor(private readonly svc: DrugSubstitutionService) {}

  @Post('suggest')
  async suggest(
    @Req() req: any,
    @Body() body: {
      originalDrug: string;
      originalDose?: string;
      patientId?: number;
      diagnoses?: string[];
      allergies?: string[];
    },
  ) {
    return this.svc.getSuggestions(req.tenantDb, {
      ...body,
      requestedBy: req.user.sub,
      subdomain: req.tenantSubdomain,
    });
  }

  @Patch(':id/select')
  async select(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { selectedDrug: string },
  ) {
    await this.svc.selectSubstitute(
      req.tenantDb,
      parseInt(id),
      body.selectedDrug,
      req.user.sub,
    );
    return { ok: true };
  }

  @Get('patient/:patientId/history')
  async history(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientHistory(req.tenantDb, parseInt(patientId));
  }
}
