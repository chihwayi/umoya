import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { TheatreService } from '../services/theatre.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('theatre')
@UseGuards(JwtAuthGuard)
export class TheatreController {
  constructor(private readonly theatre: TheatreService) {}

  @Get('rooms')
  listRooms(@Req() req: any) {
    return this.theatre.listRooms(req.tenantDb);
  }

  @Post('cases')
  scheduleCase(@Req() req: any, @Body() body: any) {
    return this.theatre.scheduleCase(req.tenantDb, body);
  }

  @Get('cases')
  getDaySchedule(@Req() req: any, @Query('date') date?: string) {
    return this.theatre.getDaySchedule(req.tenantDb, date ?? new Date().toISOString().split('T')[0]);
  }

  @Get('metrics')
  getMetrics(@Req() req: any, @Query('date') date?: string) {
    return this.theatre.getUtilizationMetrics(req.tenantDb, date ?? new Date().toISOString().split('T')[0]);
  }

  @Patch('cases/:id/start')
  startCase(@Req() req: any, @Param('id') id: string) {
    return this.theatre.startCase(req.tenantDb, id);
  }

  @Patch('cases/:id/end')
  endCase(@Req() req: any, @Param('id') id: string) {
    return this.theatre.endCase(req.tenantDb, id);
  }

  @Patch('cases/:id/cancel')
  cancelCase(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string; note?: string }) {
    return this.theatre.cancelCase(req.tenantDb, id, body.reason, body.note);
  }
}
