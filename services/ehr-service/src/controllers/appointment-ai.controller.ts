import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AppointmentAiService } from '../services/appointment-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentAiController {
  constructor(private readonly apptAi: AppointmentAiService) {}

  @Get(':id/brief')
  async getBrief(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    let brief = await this.apptAi.getBrief(id, req.tenantDb);
    if (!brief) {
      brief = await this.apptAi.generateBrief(id, req.tenantDb);
    }
    return brief;
  }

  @Post(':id/regenerate-brief')
  async regenerateBrief(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    return this.apptAi.generateBrief(id, req.tenantDb);
  }

  @Get(':id/noshow-score')
  async getNoShowScore(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    return this.apptAi.getNoShowScore(id, req.tenantDb);
  }

  @Post(':id/score-noshow')
  async scoreNoShow(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    const rows = await req.tenantDb.query(
      `SELECT patient_id FROM appointments WHERE id = $1`,
      [id],
    );
    if (!rows.length) return { error: 'Not found' };
    return this.apptAi.scoreNoShow(id, rows[0].patient_id, req.tenantDb);
  }
}
