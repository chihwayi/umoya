import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WellBabyService } from '../services/well-baby.service';

@UseGuards(JwtAuthGuard)
@Controller('well-baby')
export class WellBabyController {
  constructor(private readonly wb: WellBabyService) {}

  @Post('visits')
  recordVisit(
    @Req() req: any,
    @Body() body: {
      patientId: string; visitType: string; weightKg?: number; lengthCm?: number;
      headCircCm?: number; ageMonths?: number; breastfeeding?: string;
      vitaminAGiven?: boolean; ironGiven?: boolean; zincGiven?: boolean;
      dewormingGiven?: boolean; parentalConcerns?: string;
      clinicalNotes?: string; nextVisitDue?: string;
    },
  ) {
    return this.wb.recordVisit(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/visits')
  getVisitHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getVisitHistory(req.tenantDb, patientId);
  }

  @Get('patients/:patientId/growth-chart')
  getGrowthChart(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getGrowthChart(req.tenantDb, patientId);
  }

  @Post('patients/:patientId/milestones')
  recordMilestones(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: {
      ageMonths: number; visitId?: string; communicationScore?: number;
      grossMotorScore?: number; fineMotorScore?: number;
      problemSolvingScore?: number; personalSocialScore?: number;
      overallResult?: string; redFlags?: string[]; referralMade?: boolean; referralType?: string;
    },
  ) {
    return this.wb.recordMilestones(req.tenantDb, req.user.id, patientId, body);
  }

  @Get('patients/:patientId/milestones')
  getMilestones(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getMilestones(req.tenantDb, patientId);
  }

  @Post('patients/:patientId/nutrition')
  recordNutrition(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { muacCm?: number; oedema?: boolean; classification: string; appetiteTest?: string; enrolledRutf?: boolean; notes?: string; visitId?: string },
  ) {
    return this.wb.recordNutritionAssessment(req.tenantDb, req.user.id, patientId, body);
  }

  @Get('overdue')
  getOverdueVisits(@Req() req: any, @Query('days') days?: string) {
    return this.wb.getOverdueVisits(req.tenantDb, Number(days ?? 14));
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.wb.getDashboard(req.tenantDb);
  }
}
